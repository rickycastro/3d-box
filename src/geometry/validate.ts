// Pure parameter validation, dependency-free so the worker, the store, and the
// smoke test can all share it.
//
// Two tiers (see plan):
//  1. clamp()    — hard per-field bounds, silently applied (never meaningful outside).
//  2. validate() — cross-parameter compatibility; surfaced as errors the user
//                  must resolve. Geometry build is SKIPPED while any error exists.

import {
  MIN_COMPARTMENT_MM,
  MIN_POCKET_WALL_MARGIN_MM,
  PRINT_VOLUME_MM,
  RANGES,
  type ParamKey,
  type SnapBoxParams,
  type ValidationError,
} from './types';

const round = (v: number, step: number) =>
  step >= 1 ? Math.round(v / step) * step : v;

/** Clamp every field to its hard bound; coerce non-finite to the default-safe min. */
export function clamp(params: SnapBoxParams): SnapBoxParams {
  const out = { ...params };
  for (const key of Object.keys(RANGES) as ParamKey[]) {
    const r = RANGES[key];
    let v = out[key];
    if (!Number.isFinite(v)) v = r.min;
    if (r.integer) v = Math.round(v);
    v = round(v, r.step);
    v = Math.min(r.max, Math.max(r.min, v));
    out[key] = v;
  }
  return out;
}

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

/** Tier-2 cross-parameter compatibility checks. Empty array == buildable. */
export function validate(params: SnapBoxParams): ValidationError[] {
  const { w, l, h, wDivisions, lDivisions, snapDepth, thickness, clearance, thumbDiameter } =
    params;
  const t = thickness;
  const c = clearance;
  const errors: ValidationError[] = [];

  // 1. Print-volume fit (lid exterior footprint + height, standing orientation).
  const lidW = w + 4 * t + 2 * c;
  const lidL = l + 4 * t + 2 * c;
  const lidH = h + 2 * t;
  if (lidW > PRINT_VOLUME_MM) {
    errors.push({
      keys: ['w', 'thickness'],
      message: `Lid width ${fmt(lidW)}mm exceeds the ${PRINT_VOLUME_MM}mm print volume — reduce width.`,
    });
  }
  if (lidL > PRINT_VOLUME_MM) {
    errors.push({
      keys: ['l', 'thickness'],
      message: `Lid length ${fmt(lidL)}mm exceeds the ${PRINT_VOLUME_MM}mm print volume — reduce length.`,
    });
  }
  if (lidH > PRINT_VOLUME_MM) {
    errors.push({
      keys: ['h', 'thickness'],
      message: `Lid height ${fmt(lidH)}mm exceeds the ${PRINT_VOLUME_MM}mm print volume — reduce height.`,
    });
  }

  // 2. Compartment size floor.
  const cw = (w - (wDivisions - 1) * t) / wDivisions;
  if (cw < MIN_COMPARTMENT_MM) {
    errors.push({
      keys: ['wDivisions', 'w'],
      message: `Width compartment would be ${fmt(cw)}mm — increase width or reduce width divisions.`,
    });
  }
  const cl = (l - (lDivisions - 1) * t) / lDivisions;
  if (cl < MIN_COMPARTMENT_MM) {
    errors.push({
      keys: ['lDivisions', 'l'],
      message: `Length compartment would be ${fmt(cl)}mm — increase length or reduce length divisions.`,
    });
  }

  // 3. Thumb-notch fit. The notch runs along the span of the feature wall. Per
  //    the wall-selection rule the default feature wall spans `l` (for a square
  //    footprint span == w == l, so `l` is still correct). The female pockets
  //    (widest feature, SNAP_LENGTH + 2*clearance) plus corner-fillet margin
  //    (WALL each end) must fit within that span.
  const span = l;
  const needed = thumbDiameter + 2 * c + 2 * t;
  if (needed > span) {
    errors.push({
      keys: ['thumbDiameter', 'l'],
      message: `Thumb notch needs ${fmt(needed)}mm of wall but length span is only ${fmt(span)}mm — reduce the thumb notch or increase length.`,
    });
  }

  // 4. Snap depth vs wall thickness. Female pocket is cut to snapDepth+clearance;
  //    must leave a printable wall behind it (strict, with margin).
  const pocketDepth = snapDepth + c;
  if (pocketDepth > t - MIN_POCKET_WALL_MARGIN_MM) {
    errors.push({
      keys: ['snapDepth', 'thickness'],
      message: `Snap pocket depth ${fmt(pocketDepth)}mm leaves too little wall (needs ${fmt(t - MIN_POCKET_WALL_MARGIN_MM)}mm max) — reduce snap depth or increase wall thickness.`,
    });
  }

  // 5. Vertical snap fit. The bottom and top snap indents each sit 2*thickness
  //    clear of their nearest edge and have a base half-height of snapDepth, so
  //    their base edges span [2t, 2t+2sd] and [exH-2t-2sd, exH-2t] (exH = h+t).
  //    Short boxes make these overlap; require a positive gap between them.
  const snapBottomTop = 2 * t + 2 * snapDepth; // upper edge of the bottom indent
  const snapTopBottom = h + t - 2 * t - 2 * snapDepth; // lower edge of the top indent
  if (snapBottomTop >= snapTopBottom) {
    const minH = 3 * t + 4 * snapDepth; // h must exceed this for a positive gap
    errors.push({
      keys: ['h', 'snapDepth', 'thickness'],
      message: `Box is too short for the snaps — the top and bottom snap indents overlap. Height must exceed ${fmt(minH)}mm (increase height, or reduce snap depth or wall thickness).`,
    });
  }

  return errors;
}
