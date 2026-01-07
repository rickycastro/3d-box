export type ShapeType = "box";
export type ThicknessMode = "uniform" | "custom";

export type ShapeParams = {
  shape: ShapeType;
  includeLid: boolean;
  insideWidth: number;
  insideDepth: number;
  insideHeight: number;
  includeInsideRadius: boolean;
  insideRadius: number;
  thicknessMode: ThicknessMode;
  thickness: number;
  wallThickness: number;
  topThickness: number;
  bottomThickness: number;
  clearance: number;
};

export const defaultParams: ShapeParams = {
  shape: "box",
  includeLid: true,
  insideWidth: 10,
  insideDepth: 10,
  insideHeight: 10,
  includeInsideRadius: true,
  insideRadius: 2.5,
  thicknessMode: "uniform",
  thickness: 1.67,
  wallThickness: 1.67,
  topThickness: 1.67,
  bottomThickness: 1.67,
  clearance: 0.2
};

const readNumber = (value: string | null, fallback: number) => {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readBoolean = (value: string | null, fallback: boolean) => {
  if (value === null) return fallback;
  return value === "1" || value === "true";
};

export const roundTo = (value: number, digits = 3) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

export const parseParams = (search: string): ShapeParams => {
  const query = new URLSearchParams(search);
  const thicknessMode = query.get("tmode");

  return {
    shape: defaultParams.shape,
    includeLid: readBoolean(query.get("lid"), defaultParams.includeLid),
    insideWidth: readNumber(query.get("w"), defaultParams.insideWidth),
    insideDepth: readNumber(query.get("d"), defaultParams.insideDepth),
    insideHeight: readNumber(query.get("h"), defaultParams.insideHeight),
    includeInsideRadius: readBoolean(
      query.get("radius"),
      defaultParams.includeInsideRadius
    ),
    insideRadius: readNumber(query.get("r"), defaultParams.insideRadius),
    thicknessMode:
      thicknessMode === "custom" ? "custom" : defaultParams.thicknessMode,
    thickness: readNumber(query.get("t"), defaultParams.thickness),
    wallThickness: readNumber(
      query.get("tw"),
      defaultParams.wallThickness
    ),
    topThickness: readNumber(query.get("tt"), defaultParams.topThickness),
    bottomThickness: readNumber(
      query.get("tb"),
      defaultParams.bottomThickness
    ),
    clearance: readNumber(query.get("c"), defaultParams.clearance)
  };
};

export const paramsToSearch = (params: ShapeParams) => {
  const query = new URLSearchParams();
  query.delete("shape");
  if (params.includeLid !== defaultParams.includeLid) {
    query.set("lid", params.includeLid ? "1" : "0");
  }

  if (params.insideWidth !== defaultParams.insideWidth) {
    query.set("w", roundTo(params.insideWidth).toString());
  }
  if (params.insideDepth !== defaultParams.insideDepth) {
    query.set("d", roundTo(params.insideDepth).toString());
  }
  if (params.insideHeight !== defaultParams.insideHeight) {
    query.set("h", roundTo(params.insideHeight).toString());
  }

  if (params.includeInsideRadius !== defaultParams.includeInsideRadius) {
    query.set("radius", params.includeInsideRadius ? "1" : "0");
  }
  if (params.insideRadius !== defaultParams.insideRadius) {
    query.set("r", roundTo(params.insideRadius).toString());
  }

  if (params.thicknessMode !== defaultParams.thicknessMode) {
    query.set("tmode", params.thicknessMode);
  }
  if (params.thickness !== defaultParams.thickness) {
    query.set("t", roundTo(params.thickness).toString());
  }
  if (params.wallThickness !== defaultParams.wallThickness) {
    query.set("tw", roundTo(params.wallThickness).toString());
  }
  if (params.topThickness !== defaultParams.topThickness) {
    query.set("tt", roundTo(params.topThickness).toString());
  }
  if (params.bottomThickness !== defaultParams.bottomThickness) {
    query.set("tb", roundTo(params.bottomThickness).toString());
  }
  if (params.clearance !== defaultParams.clearance) {
    query.set("c", roundTo(params.clearance).toString());
  }

  return query.toString();
};

export const normalizeParamsForCad = (params: ShapeParams): ShapeParams => params;
