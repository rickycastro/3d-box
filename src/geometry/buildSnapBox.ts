// Pure geometry builder for the two-piece snap box (tray + telescoping lid).
//
// Uses only the replicad API. NO OpenCascade init side effects here — init
// happens once in the worker before this is ever called.
//
// Coordinate system: both parts are centered on the XY origin with their base
// at z=0, growing +Z. This makes tray-rim / lid-cap Z alignment trivial to
// reason about (see plan: assembled tray rim == lid cap underside).
//
// Geometry facts and the snap-feature spec follow docs/snap-box-configurator-plan.md.

import {
  drawRectangle,
  drawRoundedRectangle,
  makeCylinder,
  type Shape3D,
  type Sketch,
} from 'replicad';
import type { SnapBoxParams } from './types';

export interface SnapBoxSolids {
  tray: Shape3D;
  lid: Shape3D;
}

// Small overlap so booleans never operate on exactly-coincident faces (the
// classic OCCT robustness trap), and a generous overshoot for through-cuts.
const EPS = 0.01;
const MARGIN = 1;

/** Which wall(s) carry the notch + snap features, with their transforms. */
interface Wall {
  /** Rotation (deg, about Z) mapping the canonical +Y-protruding snap solid to
   * this wall's inward direction; also maps the snap length onto the span axis. */
  angle: number;
  /** Unit outward normal axis: 'X' or 'Y'. */
  axis: 'X' | 'Y';
  /** Sign of the outward normal along that axis. */
  sign: 1 | -1;
}

// Canonical snap protrudes +Y. Rotations: +90 → -X, -90 → +X, 180 → -Y, 0 → +Y.
const WALL_PX: Wall = { angle: 90, axis: 'X', sign: 1 };
const WALL_NX: Wall = { angle: -90, axis: 'X', sign: -1 };
const WALL_PY: Wall = { angle: 180, axis: 'Y', sign: 1 };
const WALL_NY: Wall = { angle: 0, axis: 'Y', sign: -1 };

/**
 * Cut `tool` from `body`, then dispose both inputs, returning only the result.
 * Explicit disposal is a correctness requirement — OCCT/replicad shapes hold
 * WASM-heap memory that JS GC never reclaims (see plan: repeated rebuilds during
 * slider drags would otherwise leak the heap until the tab dies, worst on mobile).
 */
function cutInto(body: Shape3D, tool: Shape3D): Shape3D {
  const result = body.cut(tool) as Shape3D;
  tool.delete();
  body.delete();
  return result;
}

function fuseInto(body: Shape3D, tool: Shape3D): Shape3D {
  const result = body.fuse(tool) as Shape3D;
  tool.delete();
  body.delete();
  return result;
}

/**
 * The shared symmetric snap solid, used for BOTH the male ridge (fused onto the
 * lid) and — rebuilt larger by clearance — the female pocket cutters (cut from
 * the tray). Building both from one helper guarantees they mate.
 *
 * Canonical frame: base capsule lies in the XZ plane at Y=0 (length along X,
 * height 2*depth along Z, a true stadium: corner radius == depth), lofting
 * toward +Y to a RIDGE LINE at Y=depth. The taper is a constant 45° inward
 * offset on every side, so the end profile is the base capsule offset inward by
 * `depth`: length shrinks to (length - 2*depth), height shrinks to 0 → a line.
 *
 * This is confirmed by the sample STEP files: apex points sit at Y = base-depth,
 * spanning x=±9 at mid-height (a length-18 ridge line for the 20mm/1mm snap),
 * NOT converging to a single point. The 12 conical surfaces per file are exactly
 * the two tapered semicircular ends of each of the 4 tray indents + 2 lid ridges.
 *
 * The ridge line is realised as a loft to a near-degenerate thin capsule
 * (height RIDGE_EPS) rather than a mathematically-open line segment — OCCT's
 * ThruSections needs closed sections, and a 0.02mm-thick top is imperceptible
 * and manufacturable-identical while keeping the boolean robust. Male and female
 * differ ONLY by the clearance offset (bigger length + depth), so they mate.
 *
 * @param length capsule length (male: SNAP_LENGTH; female: SNAP_LENGTH + 2*clearance)
 * @param depth  protrusion / cut depth (male: snapDepth; female: snapDepth + clearance)
 */
const RIDGE_EPS = 0.02;
function makeSnapSolid(length: number, depth: number): Shape3D {
  const baseHeight = 2 * depth;
  const ridgeLen = Math.max(RIDGE_EPS, length - 2 * depth);
  // The "XZ" plane's normal is -Y, and the origin offset runs along that normal,
  // so origin 0 sits at Y=0 and origin -depth sits at Y=+depth. Building the base
  // at Y=0 and the ridge at Y=+depth makes the snap protrude toward +Y (canonical).
  const baseSketch = drawRoundedRectangle(length, baseHeight, depth).sketchOnPlane(
    'XZ',
    0,
  ) as Sketch;
  const ridgeSketch = drawRoundedRectangle(ridgeLen, RIDGE_EPS, RIDGE_EPS / 2).sketchOnPlane(
    'XZ',
    -depth,
  ) as Sketch;
  // loftWith lofts base.wire -> ridge.wire and disposes both sketches for us.
  return baseSketch.loftWith(ridgeSketch) as Shape3D;
}

/**
 * Position a canonical snap solid onto a wall: rotate to face inward, then
 * translate its base center to `[bx, by, bz]` (a point on the wall face).
 */
function placeOnWall(
  solid: Shape3D,
  wall: Wall,
  center: [number, number, number],
): Shape3D {
  // NB: replicad's rotate()/translate() CONSUME the receiver (they delete `this`
  // and return a new shape), unlike cut()/fuse(). So we must NOT delete the
  // pre-transform handle — just chain and return the final shape.
  const rotated =
    wall.angle === 0 ? solid : (solid.rotate(wall.angle, [0, 0, 0], [0, 0, 1]) as Shape3D);
  return rotated.translate(center) as Shape3D;
}

/** In-plane offset (into/out of the wall) for embedding a feature by EPS. */
function faceCenter(
  wall: Wall,
  faceCoord: number,
  z: number,
  embed: number,
): [number, number, number] {
  // `faceCoord` is the |coordinate| of the wall face along its normal axis.
  const coord = wall.sign * (faceCoord + embed);
  return wall.axis === 'X' ? [coord, 0, z] : [0, coord, z];
}

export function buildSnapBox(params: SnapBoxParams): SnapBoxSolids {
  const { w, l, h, wDivisions, lDivisions, snapDepth, thickness, clearance, thumbDiameter } =
    params;
  const t = thickness;
  const c = clearance;
  const sd = snapDepth;
  const SNAP_LENGTH = thumbDiameter;
  const R_THUMB = thumbDiameter / 2;

  // Feature walls, per part:
  //  - Rectangular (w ≠ l): both parts use the two width-edge walls (±Y, span w)
  //    — 2 female indents per tray wall (4 total), 1 male ridge + thumb notch per
  //    lid wall. Confirmed by the sample STEP files (12 conical surfaces = 4 tray
  //    indents + 2 lid ridges, each with 2 tapered ends).
  //  - Square (w === l): the TRAY gets indents on all four walls (so the lid can
  //    snap on in any 90° rotation), but the LID keeps a single set of ridges +
  //    thumbholes on two opposite walls. The lid's pair always lands on a tray
  //    wall that has matching indents, whatever the rotation.
  const trayWalls: Wall[] = w === l ? [WALL_PX, WALL_NX, WALL_PY, WALL_NY] : [WALL_PY, WALL_NY];
  const lidWalls: Wall[] = [WALL_PY, WALL_NY];

  const tray = buildTray();
  const lid = buildLid();
  return { tray, lid };

  // ---- Tray ----------------------------------------------------------------
  function buildTray(): Shape3D {
    const exW = w + 2 * t;
    const exL = l + 2 * t;
    const exH = h + t; // floor t + interior wall height h; wall top flush (no rim step)

    // 1. Exterior shell with rounded vertical corners baked into the profile
    //    (radius = WALL), which is exactly the "fillet corners, radius WALL"
    //    step done as construction rather than a fragile edge-finder pass.
    let body = drawRoundedRectangle(exW, exL, t)
      .sketchOnPlane('XY')
      .extrude(exH) as Shape3D;

    // 2. Interior cavity (sharp interior corners — constant-thickness wall with
    //    exterior radius t gives interior radius 0). Overshoot the open top.
    const cavity = drawRectangle(w, l)
      .sketchOnPlane('XY', t)
      .extrude(h + t) as Shape3D;
    body = cutInto(body, cavity);

    // 3. Divider grid. Dividers span the full interior and full height h.
    for (let i = 1; i < wDivisions; i++) {
      const cw = (w - (wDivisions - 1) * t) / wDivisions;
      const x = -w / 2 + i * cw + (i - 1) * t + t / 2;
      const div = drawRectangle(t, l)
        .sketchOnPlane('XY', t)
        .extrude(h)
        .translate([x, 0, 0]) as Shape3D;
      body = fuseInto(body, div);
    }
    for (let j = 1; j < lDivisions; j++) {
      const cl = (l - (lDivisions - 1) * t) / lDivisions;
      const y = -l / 2 + j * cl + (j - 1) * t + t / 2;
      const div = drawRectangle(w, t)
        .sketchOnPlane('XY', t)
        .extrude(h)
        .translate([0, y, 0]) as Shape3D;
      body = fuseInto(body, div);
    }

    // 4. Female snap pockets: TWO per selected wall, cut into the EXTERIOR face.
    const extHalfX = exW / 2; // = w/2 + t
    const extHalfY = exL / 2; // = l/2 + t
    const femLength = SNAP_LENGTH + 2 * c;
    const femDepth = sd + c;
    // Centerline rule (owner-confirmed; the 45°/snapDepth protrusion has a base
    // height of 2*snapDepth, so its half-height == snapDepth):
    //   bottom indent center = (t + snapDepth) up from the base
    //   top indent center    = (t + snapDepth) down from the top lip (rim, exH)
    //                        = exH - (t + snapDepth) = h - snapDepth
    // NOTE: only the base sample ai-75(1)-50(1)-25 places the TOP indent
    // correctly (24 = h - snapDepth). The other six samples inherited a
    // parametric error that shifts the top indent down by one wall thickness
    // (to h - snapDepth - t); the bottom indent is correct in all seven. We
    // follow the correct rule below and intentionally do NOT reproduce that bug.
    const zBottom = t + sd;
    const zTop = exH - (t + sd); // = h - snapDepth
    for (const wall of trayWalls) {
      const faceHalf = wall.axis === 'X' ? extHalfX : extHalfY;
      for (const z of [zTop, zBottom]) {
        const tool = placeOnWall(
          makeSnapSolid(femLength, femDepth),
          wall,
          faceCenter(wall, faceHalf, z, EPS), // base EPS OUTSIDE the face
        );
        body = cutInto(body, tool);
      }
    }

    // (No cosmetic rim chamfer: the plan hypothesized a ~1.14mm rim lead-in, but
    //  no matching radius exists in the sample STEP files, so we don't invent one.
    //  Every remaining tray feature maps to a confirmed surface in the samples:
    //  corner fillets r=1.67, exterior/interior faces, dividers, female pockets.)
    return body;
  }

  // ---- Lid -----------------------------------------------------------------
  function buildLid(): Shape3D {
    // Inner skirt = tray exterior + 2*clearance; outer skirt = inner + 2*WALL.
    const innerW = w + 2 * t + 2 * c;
    const innerL = l + 2 * t + 2 * c;
    const outerW = innerW + 2 * t;
    const outerL = innerL + 2 * t;
    const lidHeight = h + 2 * t;
    const rInner = t + c; // nested corner fillet radii, baked into the profiles
    const rOuter = 2 * t + c;

    // 1. Outer shell.
    let body = drawRoundedRectangle(outerW, outerL, rOuter)
      .sketchOnPlane('XY')
      .extrude(lidHeight) as Shape3D;

    // 2. Cavity open at the bottom, solid cap (thickness WALL) at the top.
    //    Cavity depth = h + t == tray exterior height (telescopes flush).
    const cavity = drawRoundedRectangle(innerW, innerL, rInner)
      .sketchOnPlane('XY', -MARGIN)
      .extrude(h + t + MARGIN) as Shape3D;
    body = cutInto(body, cavity);

    const innerHalfX = innerW / 2; // = w/2 + t + c
    const innerHalfY = innerL / 2;
    const outerHalfX = outerW / 2;
    const outerHalfY = outerL / 2;

    // 3. Thumb notch(es): semicircular scallop on the bottom opening edge of the
    //    target wall's midpoint. Cylinder axis == wall normal, full-thickness.
    for (const wall of lidWalls) {
      const innerHalf = wall.axis === 'X' ? innerHalfX : innerHalfY;
      const outerHalf = wall.axis === 'X' ? outerHalfX : outerHalfY;
      const cutter = makeThumbCutter(wall, innerHalf, outerHalf, R_THUMB);
      body = cutInto(body, cutter);
    }

    // 4. Male snap ridge(s): one per width wall, fused onto the INTERIOR face at
    //    z = h - snapDepth — the same centerline as the tray's TOP indent, so the
    //    two engage in normal assembly (and the ridge meets the tray's BOTTOM
    //    indent in the flipped/alternate nesting mode). Lid and tray share base
    //    z=0, so this z is identical in both frames.
    const zRidge = h - sd;
    for (const wall of lidWalls) {
      const faceHalf = wall.axis === 'X' ? innerHalfX : innerHalfY;
      const ridge = placeOnWall(
        makeSnapSolid(SNAP_LENGTH, sd),
        wall,
        faceCenter(wall, faceHalf, zRidge, EPS), // base EPS embedded INTO the wall
      );
      body = fuseInto(body, ridge);
    }

    return body;
  }

  /** A full-thickness cylinder cutter along the wall normal at the wall midpoint. */
  function makeThumbCutter(
    wall: Wall,
    innerHalf: number,
    outerHalf: number,
    radius: number,
  ): Shape3D {
    const len = t + 2 * MARGIN;
    // Start just outside the outer face, run inward past the inner face.
    const start = wall.sign * (outerHalf + MARGIN);
    const dir: [number, number, number] = wall.axis === 'X' ? [-wall.sign, 0, 0] : [0, -wall.sign, 0];
    const loc: [number, number, number] =
      wall.axis === 'X' ? [start, 0, 0] : [0, start, 0];
    // makeCylinder(radius, height, location, direction)
    return makeCylinder(radius, len, loc, dir) as unknown as Shape3D;
  }
}
