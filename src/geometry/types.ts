// Shared parameter model for the snap-box configurator.
// Kept dependency-free so it can be imported from the main thread, the worker,
// and the geometry builder alike.

export interface SnapBoxParams {
  /** Interior width, mm (X axis). */
  w: number;
  /** Interior length, mm (Y axis). */
  l: number;
  /** Interior height, mm (Z axis). */
  h: number;
  /** Compartment count along w (dividers perpendicular to X). */
  wDivisions: number;
  /** Compartment count along l (dividers perpendicular to Y). */
  lDivisions: number;
  /** Depth of the male snap protrusion, mm. */
  snapDepth: number;
  /** Wall / floor thickness, mm. */
  thickness: number;
  /** Lid/tray fit gap; also the female-pocket oversize offset, mm. */
  clearance: number;
  /** Thumb-notch diameter, mm. Also drives SNAP_LENGTH (independent of `notch`). */
  thumbDiameter: number;
  /** Cut the finger scallop(s) into the lid. */
  notch: boolean;
  /** Build the male ridge + female snap pockets that latch the lid to the tray. */
  snap: boolean;
}

export type ParamKey = keyof SnapBoxParams;

/** Param keys backed by a numeric Range field (everything except booleans). */
export type NumericParamKey = Exclude<ParamKey, BoolParamKey>;
/** Boolean feature-toggle keys. */
export type BoolParamKey = 'notch' | 'snap';

export const DEFAULTS: SnapBoxParams = {
  w: 75,
  l: 50,
  h: 25,
  wDivisions: 1,
  lDivisions: 1,
  snapDepth: 0.6,
  thickness: 1.67,
  clearance: 0.2,
  thumbDiameter: 20,
  notch: true,
  snap: false,
};

/** Short URL query keys, one per param. */
export const URL_KEYS: Record<ParamKey, string> = {
  w: 'w',
  l: 'l',
  h: 'h',
  wDivisions: 'wDiv',
  lDivisions: 'lDiv',
  snapDepth: 'snapDepth',
  thickness: 'thickness',
  clearance: 'clearance',
  thumbDiameter: 'thumbDiameter',
  notch: 'notch',
  snap: 'snap',
};

export interface Range {
  min: number;
  max: number;
  /** Value-rounding precision applied on clamp. */
  step: number;
  /** Whole numbers only (divisions). */
  integer?: boolean;
  label: string;
  unit?: string;
}

// Tier-1 HARD per-field bounds. Values outside these are never meaningful and
// are silently clamped in the store. Cross-parameter compatibility (tier 2)
// lives in validate(), NOT here.
export const RANGES: Record<NumericParamKey, Range> = {
  w: { min: 1, max: 300, step: 0.01, label: 'Inner width', unit: 'mm' },
  l: { min: 1, max: 300, step: 0.01, label: 'Inner length', unit: 'mm' },
  h: { min: 1, max: 300, step: 0.01, label: 'Inner height', unit: 'mm' },
  wDivisions: { min: 1, max: 50, step: 1, integer: true, label: 'Width divisions' },
  lDivisions: { min: 1, max: 50, step: 1, integer: true, label: 'Length divisions' },
  snapDepth: { min: 0.2, max: 2, step: 0.05, label: 'Snap depth', unit: 'mm' },
  thickness: { min: 0.8, max: 5, step: 0.01, label: 'Wall thickness', unit: 'mm' },
  clearance: { min: 0.05, max: 1, step: 0.01, label: 'Clearance', unit: 'mm' },
  thumbDiameter: { min: 10, max: 40, step: 0.5, label: 'Notch diameter', unit: 'mm' },
};

export const PARAM_ORDER: NumericParamKey[] = [
  'w',
  'l',
  'h',
  'wDivisions',
  'lDivisions',
  'thickness',
  'snapDepth',
  'clearance',
  'thumbDiameter',
];

/**
 * Base export filename (no extension), shared by the worker and the UI so they
 * never drift. Divisions are appended in parens only when > 1, mirroring the
 * sample naming convention (e.g. box-tray-w75(4)-l50(2)-h25).
 */
export function exportBaseName(p: SnapBoxParams, part: 'tray' | 'lid'): string {
  const wDiv = p.wDivisions > 1 ? `(${p.wDivisions})` : '';
  const lDiv = p.lDivisions > 1 ? `(${p.lDivisions})` : '';
  return `box-${part}-w${p.w}${wDiv}-l${p.l}${lDiv}-h${p.h}`;
}

export interface ValidationError {
  /** Param field(s) implicated by this error (for UI highlighting). */
  keys: ParamKey[];
  /** Human-readable reason. */
  message: string;
}

// Print-volume ceiling (Bambu Lab P1S usable plate, with safety margin vs the
// nominal 256mm). Assumes the box prints standing at full height.
export const PRINT_VOLUME_MM = 250;
/** Minimum viable compartment interior size, mm. */
export const MIN_COMPARTMENT_MM = 1;
/** Minimum wall material left behind a female snap pocket, mm (printability). */
export const MIN_POCKET_WALL_MARGIN_MM = 0.4;
