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
  /** Thumb-notch diameter, mm. Also drives SNAP_LENGTH. */
  thumbDiameter: number;
}

export type ParamKey = keyof SnapBoxParams;

export const DEFAULTS: SnapBoxParams = {
  w: 75,
  l: 50,
  h: 25,
  wDivisions: 1,
  lDivisions: 1,
  snapDepth: 1,
  thickness: 1.67,
  clearance: 0.2,
  thumbDiameter: 20,
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
};

export interface Range {
  min: number;
  max: number;
  step: number;
  /** Whole numbers only (divisions). */
  integer?: boolean;
  label: string;
  unit?: string;
}

// Tier-1 HARD per-field bounds. Values outside these are never meaningful and
// are silently clamped in the store. Cross-parameter compatibility (tier 2)
// lives in validate(), NOT here.
export const RANGES: Record<ParamKey, Range> = {
  w: { min: 1, max: 300, step: 1, label: 'Width', unit: 'mm' },
  l: { min: 1, max: 300, step: 1, label: 'Length', unit: 'mm' },
  h: { min: 1, max: 300, step: 1, label: 'Height', unit: 'mm' },
  wDivisions: { min: 1, max: 50, step: 1, integer: true, label: 'Width divisions' },
  lDivisions: { min: 1, max: 50, step: 1, integer: true, label: 'Length divisions' },
  snapDepth: { min: 0.2, max: 2, step: 0.05, label: 'Snap depth', unit: 'mm' },
  thickness: { min: 0.8, max: 5, step: 0.01, label: 'Wall thickness', unit: 'mm' },
  clearance: { min: 0.05, max: 1, step: 0.01, label: 'Clearance', unit: 'mm' },
  thumbDiameter: { min: 10, max: 40, step: 0.5, label: 'Thumb notch', unit: 'mm' },
};

export const PARAM_ORDER: ParamKey[] = [
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
