import {
  initOpenCascade,
  ocMainJS,
  ocMainWasm,
  ocCore,
  ocModelingAlgorithms,
  TKSTEP,
  TKSTEPAttr,
  TKSTEP209,
  TKSTEPBase,
  TKXSBase
} from "opencascade.js";
import type { ShapeParams } from "./params";

let ocPromise: Promise<any> | null = null;

const wasmMap = import.meta.glob<string>(
  "/node_modules/opencascade.js/dist/*.wasm",
  { query: "?url", import: "default", eager: true }
);
const wasmUrls = Object.fromEntries(
  Object.entries(wasmMap).map(([path, url]) => [path.split("/").pop(), url])
);

const getOc = () => {
  if (!ocPromise) {
    ocPromise = initOpenCascade({
      mainJS: ocMainJS,
      mainWasm: ocMainWasm,
      libs: [
        ocCore,
        ocModelingAlgorithms,
        TKXSBase,
        TKSTEPBase,
        TKSTEPAttr,
        TKSTEP209,
        TKSTEP
      ],
      module: {
        locateFile: (path: string) => {
          const file = path.split("/").pop() ?? path;
          return (wasmUrls[file] as string) ?? path;
        }
      }
    });
  }
  return ocPromise;
};

const getCtor = (oc: any, name: string) => {
  return (
    oc[name] ||
    oc[`${name}_1`] ||
    oc[`${name}_2`] ||
    oc[`${name}_3`] ||
    oc[`${name}_4`]
  );
};

const getCtorByNames = (oc: any, names: string[]) => {
  for (const name of names) {
    const ctor = oc[name];
    if (ctor) return ctor;
  }
  return null;
};

const makeBox = (oc: any, width: number, depth: number, height: number) => {
  const Ctor =
    getCtorByNames(oc, [
      "BRepPrimAPI_MakeBox_1",
      "BRepPrimAPI_MakeBox_2",
      "BRepPrimAPI_MakeBox"
    ]) ?? getCtor(oc, "BRepPrimAPI_MakeBox");
  if (!Ctor) throw new Error("OpenCascade box constructor not found.");
  const maker = new Ctor(width, depth, height);
  return maker.Shape();
};

const makePnt = (oc: any, x: number, y: number, z: number) => {
  const PntCtor =
    getCtorByNames(oc, ["gp_Pnt_1", "gp_Pnt"]) ?? getCtor(oc, "gp_Pnt");
  if (!PntCtor) {
    throw new Error("OpenCascade gp_Pnt constructor not found.");
  }
  try {
    return new PntCtor(x, y, z);
  } catch {
    // continue
  }
  try {
    const pnt = new PntCtor();
    if (typeof pnt.SetCoord === "function") {
      pnt.SetCoord(x, y, z);
      return pnt;
    }
    if (
      typeof pnt.SetX === "function" &&
      typeof pnt.SetY === "function" &&
      typeof pnt.SetZ === "function"
    ) {
      pnt.SetX(x);
      pnt.SetY(y);
      pnt.SetZ(z);
      return pnt;
    }
  } catch {
    // continue
  }
  throw new Error("Unable to build gp_Pnt with provided parameters.");
};

const debugLog = (label: string, payload?: unknown) => {
  if (typeof window !== "undefined") {
    const win = window as unknown as {
      __cadDebug?: Array<{ label: string; payload?: unknown; time: string }>;
    };
    if (!win.__cadDebug) {
      win.__cadDebug = [];
    }
    win.__cadDebug.push({
      label,
      payload,
      time: new Date().toISOString()
    });
  }
  if (payload !== undefined) {
    // eslint-disable-next-line no-console
    console.log("[CAD]", label, payload);
  } else {
    // eslint-disable-next-line no-console
    console.log("[CAD]", label);
  }
};

const pntToObj = (p: any) => {
  if (!p) return null;
  const x = toNumber(p.X?.());
  const y = toNumber(p.Y?.());
  const z = toNumber(p.Z?.());
  return { x, y, z };
};

const makeDir = (oc: any, x: number, y: number, z: number) => {
  const DirCtor =
    getCtorByNames(oc, ["gp_Dir_1", "gp_Dir"]) ?? getCtor(oc, "gp_Dir");
  if (!DirCtor) {
    throw new Error("OpenCascade gp_Dir constructor not found.");
  }
  try {
    return new DirCtor(x, y, z);
  } catch {
    // continue
  }
  try {
    const dir = new DirCtor();
    if (typeof dir.SetCoord === "function") {
      dir.SetCoord(x, y, z);
      return dir;
    }
    if (
      typeof dir.SetX === "function" &&
      typeof dir.SetY === "function" &&
      typeof dir.SetZ === "function"
    ) {
      dir.SetX(x);
      dir.SetY(y);
      dir.SetZ(z);
      return dir;
    }
  } catch {
    // continue
  }
  const XYZCtor = getCtorByNames(oc, ["gp_XYZ_1", "gp_XYZ"]) ?? getCtor(oc, "gp_XYZ");
  if (XYZCtor) {
    try {
      const xyz = new XYZCtor(x, y, z);
      return new DirCtor(xyz);
    } catch {
      // continue
    }
  }
  debugLog("gp_Dir failed", {
    hasDirCtor: Boolean(DirCtor),
    hasXYZCtor: Boolean(XYZCtor),
    x,
    y,
    z
  });
  throw new Error("Unable to build gp_Dir with provided parameters.");
};

// plane helper removed; not supported by this OCJS build

const makeEdgeLine = (oc: any, p1: any, p2: any) => {
  debugLog("makeEdgeLine", { p1: pntToObj(p1), p2: pntToObj(p2) });
  const ParamCtor =
    getCtorByNames(oc, [
      "BRepBuilderAPI_MakeEdge_2",
      "BRepBuilderAPI_MakeEdge_3",
      "BRepBuilderAPI_MakeEdge"
    ]) ?? getCtor(oc, "BRepBuilderAPI_MakeEdge");
  const EmptyCtor =
    getCtorByNames(oc, ["BRepBuilderAPI_MakeEdge_1", "BRepBuilderAPI_MakeEdge"]) ??
    getCtor(oc, "BRepBuilderAPI_MakeEdge");
  if (!ParamCtor && !EmptyCtor) {
    throw new Error("OpenCascade edge constructor not found.");
  }
  try {
    const maker = new ParamCtor(p1, p2);
    return maker.Edge ? maker.Edge() : maker.Shape();
  } catch {
    const maker = new EmptyCtor();
    const init = maker.Init ?? maker.Init_1 ?? maker.Init_2;
    if (typeof init === "function") {
      try {
        init.call(maker, p1, p2);
      } catch {
        const LineCtor =
          getCtorByNames(oc, ["GC_MakeSegment_1", "GC_MakeSegment"]) ??
          getCtor(oc, "GC_MakeSegment");
        if (!LineCtor) {
          throw new Error("OpenCascade segment constructor not found.");
        }
        const segmentMaker = new LineCtor(p1, p2);
        const curve =
          segmentMaker.Value_1?.() ??
          segmentMaker.Value?.() ??
          segmentMaker.value?.();
        init.call(maker, normalizeCurveHandle(oc, curve));
      }
      return maker.Edge ? maker.Edge() : maker.Shape();
    }
    throw new Error("OpenCascade edge builder does not accept line inputs.");
  }
};

const makeEdgeArc = (oc: any, p1: any, pmid: any, p2: any) => {
  debugLog("makeEdgeArc", {
    p1: pntToObj(p1),
    pmid: pntToObj(pmid),
    p2: pntToObj(p2)
  });
  const ArcCtor =
    getCtorByNames(oc, ["GC_MakeArcOfCircle_4", "GC_MakeArcOfCircle_3"]) ??
    getCtor(oc, "GC_MakeArcOfCircle");
  const ParamCtor =
    getCtorByNames(oc, [
      "BRepBuilderAPI_MakeEdge_3",
      "BRepBuilderAPI_MakeEdge_2",
      "BRepBuilderAPI_MakeEdge"
    ]) ?? getCtor(oc, "BRepBuilderAPI_MakeEdge");
  const EmptyCtor =
    getCtorByNames(oc, ["BRepBuilderAPI_MakeEdge_1", "BRepBuilderAPI_MakeEdge"]) ??
    getCtor(oc, "BRepBuilderAPI_MakeEdge");
  if (!ParamCtor && !EmptyCtor) {
    throw new Error("OpenCascade edge constructor not found.");
  }

  if (ArcCtor) {
    try {
      const arcMaker = new ArcCtor(p1, pmid, p2);
      const curve =
        arcMaker.Value?.() ??
        arcMaker.Value_1?.() ??
        arcMaker.value?.();
      const curveHandle = normalizeCurveHandle(oc, curve);
      try {
        const maker = new ParamCtor(curveHandle);
        return maker.Edge ? maker.Edge() : maker.Shape();
      } catch {
        const maker = new EmptyCtor();
        const init = maker.Init ?? maker.Init_1 ?? maker.Init_2;
        if (typeof init === "function") {
          init.call(maker, curveHandle);
          return maker.Edge ? maker.Edge() : maker.Shape();
        }
      }
    } catch {
      // fall back to circle/angle path
    }
  }

  const CircCtor =
    getCtorByNames(oc, ["gp_Circ_1", "gp_Circ"]) ?? getCtor(oc, "gp_Circ");
  const Ax2Ctor =
    getCtorByNames(oc, ["gp_Ax2_1", "gp_Ax2"]) ?? getCtor(oc, "gp_Ax2");
  if (!CircCtor || !Ax2Ctor) {
    throw new Error("OpenCascade circle constructor not found.");
  }
  const center = pmid;
  let axis: any;
  try {
    axis = new Ax2Ctor(center);
  } catch {
    axis = new Ax2Ctor();
    if (typeof axis.SetLocation === "function") {
      axis.SetLocation(center);
    }
  }
  const dist =
    typeof p1.Distance === "function"
      ? p1.Distance(center)
      : typeof p1.Distance_1 === "function"
        ? p1.Distance_1(center)
        : null;
  const radius = toNumber(dist);
  debugLog("arc radius", { dist, radius });
  if (!Number.isFinite(radius)) {
    throw new Error("Unable to compute arc radius.");
  }
  let circ: any;
  try {
    circ = new CircCtor(axis, radius);
  } catch {
    circ = new CircCtor();
    if (typeof circ.SetLocation === "function") {
      circ.SetLocation(center);
    }
    if (typeof circ.SetRadius === "function") {
      circ.SetRadius(radius);
    }
    if (typeof circ.SetAxis === "function") {
      const Ax1Ctor =
        getCtorByNames(oc, ["gp_Ax1_1", "gp_Ax1"]) ?? getCtor(oc, "gp_Ax1");
      if (Ax1Ctor) {
        try {
          const ax1 = new Ax1Ctor(center, makeDir(oc, 0, 0, 1));
          circ.SetAxis(ax1);
        } catch {
          // ignore
        }
      }
    }
  }
  const p1v = pntToObj(p1);
  const p2v = pntToObj(p2);
  const cv = pntToObj(center);
  const ang1 = Math.atan2(p1v.y - cv.y, p1v.x - cv.x);
  const ang2 = Math.atan2(p2v.y - cv.y, p2v.x - cv.x);
  debugLog("arc angles", { ang1, ang2 });

  const GeomCircCtor =
    getCtorByNames(oc, ["Geom_Circle_1", "Geom_Circle"]) ?? getCtor(oc, "Geom_Circle");
  if (!GeomCircCtor) {
    throw new Error("OpenCascade Geom_Circle constructor not found.");
  }
  const geomCircle = new GeomCircCtor(circ);
  const curveHandle = normalizeCurveHandle(oc, geomCircle);
  try {
    const maker = new ParamCtor(curveHandle, ang1, ang2);
    return maker.Edge ? maker.Edge() : maker.Shape();
  } catch {
    const maker = new EmptyCtor();
    const init = maker.Init ?? maker.Init_1 ?? maker.Init_2;
    if (typeof init === "function") {
      try {
        init.call(maker, curveHandle, ang1, ang2);
      } catch {
        init.call(maker, curveHandle);
      }
      return maker.Edge ? maker.Edge() : maker.Shape();
    }
    throw new Error("OpenCascade edge builder does not accept arc inputs.");
  }
};

const normalizeCurveHandle = (oc: any, curve: any) => {
  if (!curve) return curve;
  const handle = curve.GetHandle?.() ?? curve.get?.() ?? curve;
  const HandleCtor =
    getCtorByNames(oc, ["Handle_Geom_Curve_2", "Handle_Geom_Curve_1", "Handle_Geom_Curve"]) ??
    getCtor(oc, "Handle_Geom_Curve");
  if (HandleCtor) {
    try {
      return new HandleCtor(handle);
    } catch {
      // continue
    }
  }
  return handle;
};

const toNumber = (value: any) => {
  if (typeof value === "number") return value;
  if (value && typeof value.valueOf === "function") {
    const v = value.valueOf();
    if (typeof v === "number") return v;
  }
  if (value && typeof value.Value === "function") {
    return toNumber(value.Value());
  }
  if (value && typeof value.value === "function") {
    return toNumber(value.value());
  }
  if (value && typeof value.get === "function") {
    return toNumber(value.get());
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    debugLog("toNumber failed", { value });
  }
  return Number.isFinite(n) ? n : NaN;
};

const makeWireFromEdges = (oc: any, edges: any[]) => {
  const Ctor =
    getCtorByNames(oc, ["BRepBuilderAPI_MakeWire_1", "BRepBuilderAPI_MakeWire"]) ??
    getCtor(oc, "BRepBuilderAPI_MakeWire");
  if (!Ctor) {
    throw new Error("OpenCascade wire constructor not found.");
  }
  const maker = new Ctor();
  const add = maker.Add ?? maker.Add_1;
  if (typeof add !== "function") {
    throw new Error("OpenCascade wire builder does not expose Add.");
  }
  edges.forEach((edge) => add.call(maker, edge));
  return maker.Wire ? maker.Wire() : maker.Shape();
};

const castToFace = (oc: any, shape: any) => {
  if (!shape) return null;
  debugLog("castToFace", {
    shapeType: shape?.constructor?.name,
    hasTopoDS: Boolean(oc.TopoDS),
    hasFaceCtor: Boolean(oc.TopoDS_Face),
    hasToFace: Boolean(oc.TopoDS_ToFace || oc.TopoDS?.ToFace),
    hasFace: Boolean(oc.TopoDS?.Face),
    hasFaceCast: Boolean(oc.TopoDS?.Face_1 || oc.TopoDS?.Face_2)
  });
  if (shape?.constructor?.name === "TopoDS_Face") {
    return shape;
  }
  const casters = [
    oc.TopoDS?.Face_1,
    oc.TopoDS?.Face_2,
    oc.TopoDS?.Face,
    oc.TopoDS?.ToFace,
    oc.TopoDS_ToFace
  ].filter(Boolean);
  for (const caster of casters) {
    try {
      return (caster as (s: any) => any)(shape);
    } catch {
      // continue
    }
  }
  const FaceCtor =
    getCtorByNames(oc, ["TopoDS_Face_1", "TopoDS_Face"]) ??
    getCtor(oc, "TopoDS_Face");
  if (FaceCtor) {
    try {
      return new FaceCtor(shape);
    } catch {
      // continue
    }
  }
  return null;
};

const makeFaceFromWire = (oc: any, wire: any) => {
  debugLog("makeFaceFromWire", { wireType: wire?.constructor?.name });
  const WireCtor =
    getCtorByNames(oc, [
      "BRepBuilderAPI_MakeFace_15",
      "BRepBuilderAPI_MakeFace_21",
      "BRepBuilderAPI_MakeFace"
    ]) ?? getCtor(oc, "BRepBuilderAPI_MakeFace");
  const EmptyCtor =
    getCtorByNames(oc, ["BRepBuilderAPI_MakeFace_1", "BRepBuilderAPI_MakeFace"]) ??
    getCtor(oc, "BRepBuilderAPI_MakeFace");
  if (!WireCtor && !EmptyCtor) {
    throw new Error("OpenCascade face constructor not found.");
  }
  const tryReturnFace = (maker: any) => {
    const face = castToFace(oc, maker.Face ? maker.Face() : maker.Shape());
    if (!face) {
      throw new Error("OpenCascade face builder returned non-face shape.");
    }
    debugLog("makeFaceFromWire result", { faceType: face?.constructor?.name });
    return face;
  };
  if (WireCtor) {
    const attempts = [
      () => new WireCtor(wire, true),
      () => new WireCtor(wire, false),
      () => new WireCtor(wire)
    ];
    for (const attempt of attempts) {
      try {
        const maker = attempt();
        return tryReturnFace(maker);
      } catch {
        // continue
      }
    }
  }
  if (EmptyCtor) {
    const maker = new EmptyCtor();
    const add = maker.Add ?? maker.Add_1;
    if (typeof add === "function") {
      add.call(maker, wire);
      if (typeof maker.IsDone === "function" && !maker.IsDone()) {
        throw new Error("OpenCascade face builder did not complete.");
      }
      return tryReturnFace(maker);
    }
    const init = maker.Init ?? maker.Init_1 ?? maker.Init_2;
    if (typeof init === "function") {
      try {
        init.call(maker, wire, true);
        return tryReturnFace(maker);
      } catch {
        init.call(maker, wire);
        return tryReturnFace(maker);
      }
    }
  }
  throw new Error("OpenCascade face builder does not accept wire input.");
};

const makePrism = (oc: any, shape: any, height: number) => {
  const ctors = [
    oc.BRepPrimAPI_MakePrism_3,
    oc.BRepPrimAPI_MakePrism_2,
    oc.BRepPrimAPI_MakePrism_1,
    oc.BRepPrimAPI_MakePrism
  ].filter(Boolean);
  if (!ctors.length) {
    throw new Error("OpenCascade prism constructor not found.");
  }
  debugLog("makePrism input", { inputType: shape?.constructor?.name });
  const face = castToFace(oc, shape);
  if (!face) {
    throw new Error("OpenCascade prism requires a face input.");
  }
  debugLog("makePrism face", { faceType: face?.constructor?.name });
  const vec = makeVec(oc, 0, 0, height);
  const inputs: any[] = [face, shape];
  for (const Ctor of ctors) {
    for (const input of inputs) {
      try {
        const maker = new Ctor(input, vec);
        return maker.Shape();
      } catch {
        // try next
      }
    }
  }
  throw new Error("OpenCascade prism constructor could not extrude shape.");
};

const makePipeFromWire = (oc: any, wire: any, height: number, z: number) => {
  const spineEdge = makeEdgeLine(oc, makePnt(oc, 0, 0, z), makePnt(oc, 0, 0, z + height));
  const spineWire = makeWireFromEdges(oc, [spineEdge]);
  const ShellCtor =
    getCtorByNames(oc, ["BRepOffsetAPI_MakePipeShell_1", "BRepOffsetAPI_MakePipeShell"]) ??
    getCtor(oc, "BRepOffsetAPI_MakePipeShell");
  if (ShellCtor) {
    const shell = new ShellCtor(spineWire);
    const add = shell.Add ?? shell.Add_1 ?? shell.Add_2;
    if (typeof add === "function") {
      const attempts = [
        () => add.call(shell, wire, false, false),
        () => add.call(shell, wire, true, false),
        () => add.call(shell, wire, true, true),
        () => add.call(shell, wire, false),
        () => add.call(shell, wire, true),
        () => add.call(shell, wire)
      ];
      let added = false;
      for (const attempt of attempts) {
        try {
          attempt();
          added = true;
          break;
        } catch {
          // continue
        }
      }
      if (!added) {
        debugLog("pipeShell add failed");
      }
    }
    if (typeof shell.Build === "function") {
      shell.Build();
    }
    if (typeof shell.MakeSolid === "function") {
      shell.MakeSolid();
    }
    if (typeof shell.Shape === "function") {
      return shell.Shape();
    }
  }
  const PipeCtor =
    getCtorByNames(oc, ["BRepOffsetAPI_MakePipe_1", "BRepOffsetAPI_MakePipe"]) ??
    getCtor(oc, "BRepOffsetAPI_MakePipe");
  if (PipeCtor) {
    const pipe = new PipeCtor(spineWire, wire);
    return pipe.Shape();
  }
  throw new Error("OpenCascade pipe extrusion is not available.");
};

const makeAx2 = (oc: any, x: number, y: number, z: number) => {
  const Ax2Ctor =
    getCtorByNames(oc, ["gp_Ax2_1", "gp_Ax2"]) ?? getCtor(oc, "gp_Ax2");
  if (!Ax2Ctor) {
    throw new Error("OpenCascade gp_Ax2 constructor not found.");
  }
  const location = makePnt(oc, x, y, z);
  const direction = makeDir(oc, 0, 0, 1);
  try {
    return new Ax2Ctor(location, direction);
  } catch {
    // continue
  }
  try {
    const ax2 = new Ax2Ctor(location);
    if (typeof ax2.SetDirection === "function") {
      ax2.SetDirection(direction);
      return ax2;
    }
    return ax2;
  } catch {
    // continue
  }
  throw new Error("Unable to build gp_Ax2 with provided parameters.");
};

const makeBoxAt = (
  oc: any,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number
) => {
  const Ctor =
    getCtorByNames(oc, [
      "BRepPrimAPI_MakeBox_3",
      "BRepPrimAPI_MakeBox_2",
      "BRepPrimAPI_MakeBox_1",
      "BRepPrimAPI_MakeBox"
    ]) ?? getCtor(oc, "BRepPrimAPI_MakeBox");
  if (!Ctor) throw new Error("OpenCascade box constructor not found.");
  const p1 = makePnt(oc, x, y, z);
  const p2 = makePnt(oc, x + width, y + depth, z + height);
  try {
    const maker = new Ctor(p1, p2);
    return maker.Shape();
  } catch {
    // continue
  }
  try {
    const maker = new Ctor(p1, width, depth, height);
    return maker.Shape();
  } catch {
    // continue
  }
  const maker = new Ctor(width, depth, height);
  return maker.Shape();
};

const makeCylinder = (oc: any, radius: number, height: number) => {
  const Ctor =
    getCtorByNames(oc, [
      "BRepPrimAPI_MakeCylinder_1",
      "BRepPrimAPI_MakeCylinder_2",
      "BRepPrimAPI_MakeCylinder"
    ]) ?? getCtor(oc, "BRepPrimAPI_MakeCylinder");
  if (!Ctor) throw new Error("OpenCascade cylinder constructor not found.");
  const maker = new Ctor(radius, height);
  return maker.Shape();
};

const makeCylinderAt = (
  oc: any,
  radius: number,
  height: number,
  x: number,
  y: number,
  z: number
) => {
  const cylinder = makeCylinder(oc, radius, height);
  if (x === 0 && y === 0 && z === 0) {
    return cylinder;
  }
  return translateShape(oc, cylinder, x, y, z);
};

const makeXYZ = (oc: any, x: number, y: number, z: number) => {
  const XYZCtor =
    getCtorByNames(oc, ["gp_XYZ_1", "gp_XYZ"]) ?? getCtor(oc, "gp_XYZ");
  if (!XYZCtor) {
    throw new Error("OpenCascade gp_XYZ constructor not found.");
  }

  try {
    return new XYZCtor(x, y, z);
  } catch {
    // continue
  }

  try {
    const xyz = new XYZCtor();
    if (typeof xyz.SetCoord === "function") {
      xyz.SetCoord(x, y, z);
      return xyz;
    }
    if (
      typeof xyz.SetX === "function" &&
      typeof xyz.SetY === "function" &&
      typeof xyz.SetZ === "function"
    ) {
      xyz.SetX(x);
      xyz.SetY(y);
      xyz.SetZ(z);
      return xyz;
    }
  } catch {
    // continue
  }

  throw new Error("Unable to build gp_XYZ with provided parameters.");
};

const makeVec = (oc: any, x: number, y: number, z: number) => {
  const VecCtor =
    getCtorByNames(oc, ["gp_Vec_3", "gp_Vec_2", "gp_Vec_1", "gp_Vec"]) ??
    getCtor(oc, "gp_Vec");
  if (!VecCtor) {
    throw new Error("OpenCascade gp_Vec constructor not found.");
  }

  try {
    return new VecCtor(x, y, z);
  } catch {
    // continue
  }

  try {
    const vec = new VecCtor();
    if (typeof vec.SetCoord === "function") {
      vec.SetCoord(x, y, z);
      return vec;
    }
    if (
      typeof vec.SetX === "function" &&
      typeof vec.SetY === "function" &&
      typeof vec.SetZ === "function"
    ) {
      vec.SetX(x);
      vec.SetY(y);
      vec.SetZ(z);
      return vec;
    }
  } catch {
    // continue
  }

  try {
    const xyz = makeXYZ(oc, x, y, z);
    return new VecCtor(xyz);
  } catch {
    // continue
  }

  const XYZCtor = getCtorByNames(oc, ["gp_XYZ_1", "gp_XYZ"]) ?? getCtor(oc, "gp_XYZ");
  if (XYZCtor) {
    try {
      const xyz = new XYZCtor(x, y, z);
      return new VecCtor(xyz);
    } catch {
      // continue
    }
  }

  const PntCtor = getCtorByNames(oc, ["gp_Pnt_1", "gp_Pnt"]) ?? getCtor(oc, "gp_Pnt");
  if (PntCtor) {
    try {
      const origin = new PntCtor(0, 0, 0);
      const target = new PntCtor(x, y, z);
      return new VecCtor(origin, target);
    } catch {
      // continue
    }
  }

  const DirCtor = getCtorByNames(oc, ["gp_Dir_1", "gp_Dir"]) ?? getCtor(oc, "gp_Dir");
  if (DirCtor) {
    try {
      const dir = new DirCtor(x, y, z);
      return new VecCtor(dir);
    } catch {
      // continue
    }
  }

  throw new Error("Unable to build gp_Vec with provided parameters.");
};

const translateShape = (oc: any, shape: any, x: number, y: number, z: number) => {
  const TrsfCtor =
    getCtorByNames(oc, ["gp_Trsf_1", "gp_Trsf"]) ?? getCtor(oc, "gp_Trsf");
  const TransformCtor =
    getCtorByNames(oc, ["BRepBuilderAPI_Transform_1", "BRepBuilderAPI_Transform"]) ??
    getCtor(oc, "BRepBuilderAPI_Transform");
  if (!TrsfCtor || !TransformCtor) {
    throw new Error("OpenCascade transform utilities not found.");
  }
  const trsf = new TrsfCtor();
  if (typeof trsf.SetTranslation === "function") {
    const vec = makeVec(oc, x, y, z);
    trsf.SetTranslation(vec);
  } else if (typeof trsf.SetTranslationPart === "function") {
    const vec = makeVec(oc, x, y, z);
    trsf.SetTranslationPart(vec);
  } else {
    throw new Error("OpenCascade transform lacks translation methods.");
  }
  let transformer: any;
  try {
    transformer = new TransformCtor(shape, trsf, true);
  } catch {
    try {
      transformer = new TransformCtor(shape, trsf);
    } catch {
      transformer = new TransformCtor(trsf);
      if (typeof transformer.Perform === "function") {
        transformer.Perform(shape, true);
      } else if (typeof transformer.SetShape === "function") {
        transformer.SetShape(shape);
      } else if (typeof transformer.SetTrsf === "function") {
        transformer.SetTrsf(trsf);
      } else {
        throw new Error("BRepBuilderAPI_Transform does not accept a transform.");
      }
    }
  }
  if (typeof transformer.Build === "function") {
    transformer.Build();
  }
  return transformer.Shape();
};

const appendToShapeList = (list: any, shape: any) => {
  const candidates = ["Append", "Append_1", "Add", "Add_1", "Push", "Push_1"];
  for (const name of candidates) {
    if (typeof list[name] === "function") {
      list[name](shape);
      return;
    }
  }
  throw new Error("OpenCascade TopTools_ListOfShape does not expose append methods.");
};

const buildBoolean = (oc: any, opName: string, shapeA: any, shapeB: any) => {
  const Ctor =
    getCtorByNames(oc, [`${opName}_1`, `${opName}_2`, opName]) ?? getCtor(oc, opName);
  if (!Ctor) throw new Error(`OpenCascade ${opName} constructor not found.`);
  try {
    const op = new Ctor(shapeA, shapeB);
    if (typeof op.Build === "function") {
      op.Build();
    }
    return op.Shape();
  } catch {
    // continue
  }

  const op = new Ctor();
  if (typeof op.SetArguments !== "function" || typeof op.SetTools !== "function") {
    throw new Error(`OpenCascade ${opName} builder does not expose SetArguments/SetTools.`);
  }
  const ListCtor =
    getCtorByNames(oc, ["TopTools_ListOfShape_1", "TopTools_ListOfShape"]) ??
    getCtor(oc, "TopTools_ListOfShape");
  if (!ListCtor) {
    throw new Error("OpenCascade TopTools_ListOfShape not found.");
  }
  const argumentsList = new ListCtor();
  const toolsList = new ListCtor();
  appendToShapeList(argumentsList, shapeA);
  appendToShapeList(toolsList, shapeB);
  op.SetArguments(argumentsList);
  op.SetTools(toolsList);
  if (typeof op.Build === "function") {
    op.Build();
  }
  return op.Shape();
};

const cutShape = (oc: any, outer: any, inner: any) => {
  return buildBoolean(oc, "BRepAlgoAPI_Cut", outer, inner);
};

const makeCompound = (oc: any, shapes: any[]) => {
  const CompoundCtor = getCtor(oc, "TopoDS_Compound");
  const BuilderCtor = getCtor(oc, "BRep_Builder");
  if (!CompoundCtor || !BuilderCtor) {
    throw new Error("OpenCascade compound utilities not found.");
  }
  const compound = new CompoundCtor();
  const builder = new BuilderCtor();
  builder.MakeCompound(compound);
  shapes.forEach((shape) => builder.Add(compound, shape));
  return compound;
};

const writeStep = (oc: any, shape: any) => {
  const WriterCtor =
    getCtorByNames(oc, [
      "STEPControl_Writer_1",
      "STEPControl_Writer_2",
      "STEPControl_Writer"
    ]) ?? getCtor(oc, "STEPControl_Writer");
  if (!WriterCtor) throw new Error("OpenCascade STEP writer not found.");
  const writer = new WriterCtor();
  const modelType =
    oc.STEPControl_StepModelType?.STEPControl_AsIs ??
    oc.STEPControl_AsIs ??
    0;
  const transfer = writer.Transfer ?? writer.Transfer_1 ?? writer.Transfer_2;
  if (typeof transfer !== "function") {
    throw new Error("OpenCascade STEP writer does not expose Transfer.");
  }
  const boolFlag = oc.Standard_Boolean?.Standard_True ?? true;
  const progressCtor =
    getCtorByNames(oc, ["Message_ProgressRange_1", "Message_ProgressRange"]) ??
    getCtor(oc, "Message_ProgressRange");
  const progress = progressCtor ? new progressCtor() : null;
  try {
    if (progress) {
      transfer.call(writer, shape, modelType, boolFlag, progress);
    } else {
      transfer.call(writer, shape, modelType, boolFlag);
    }
  } catch {
    transfer.call(writer, shape, modelType);
  }
  const asciiCtor =
    getCtorByNames(oc, ["TCollection_AsciiString_1", "TCollection_AsciiString"]) ??
    getCtor(oc, "TCollection_AsciiString");
  const extCtor =
    getCtorByNames(oc, ["TCollection_ExtendedString_1", "TCollection_ExtendedString"]) ??
    getCtor(oc, "TCollection_ExtendedString");
  const writeFns = [writer.Write, writer.Write_1, writer.Write_2].filter(
    (fn) => typeof fn === "function"
  );

  const tryWrite = (target: string) => {
    const variants: Array<string | object> = [target];
    if (asciiCtor) {
      try {
        variants.push(new asciiCtor(target));
      } catch {
        // ignore
      }
    }
    if (extCtor) {
      try {
        variants.push(new extCtor(target));
      } catch {
        // ignore
      }
    }
    for (const variant of variants) {
      for (const fn of writeFns) {
        try {
          const status = fn.call(writer, variant);
          if (typeof status === "number" && status !== 1 && status !== 0) {
            continue;
          }
          const info = oc.FS.analyzePath(target);
          if (info.exists) {
            return true;
          }
        } catch {
          // continue
        }
      }
    }
    return false;
  };

  const filenames = ["/tmp/model.step", "/model.step", "model.step"];
  try {
    oc.FS.mkdir("/tmp");
  } catch {
    // ignore if already exists
  }

  for (const filename of filenames) {
    try {
      oc.FS.unlink(filename);
    } catch {
      // ignore if missing
    }
    if (tryWrite(filename)) {
      const data = oc.FS.readFile(filename, { encoding: "binary" });
      return data as Uint8Array;
    }
  }

  throw new Error("STEP writer did not create output file.");
};

const resolveThickness = (params: ShapeParams) => {
  if (params.thicknessMode === "uniform") {
    return {
      wall: params.thickness,
      top: params.thickness,
      bottom: params.thickness
    };
  }
  return {
    wall: params.wallThickness,
    top: params.topThickness,
    bottom: params.bottomThickness
  };
};

const clampRadius = (radius: number, maxRadius: number) => {
  const limit = Math.max(0, maxRadius - 0.01);
  return Math.min(radius, limit);
};

const buildRoundedRectPrism = (
  oc: any,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  radius: number
) => {
  const maxRadius = Math.min(width, depth) / 2;
  const r = clampRadius(radius, maxRadius);
  if (r <= 0) {
    return makeBoxAt(oc, x, y, z, width, depth, height);
  }
  const coreWidth = width - r * 2;
  const coreDepth = depth - r * 2;
  if (coreWidth <= 0 || coreDepth <= 0) {
    return makeBoxAt(oc, x, y, z, width, depth, height);
  }
  const x0 = x;
  const x1 = x + width;
  const y0 = y;
  const y1 = y + depth;

  const p1 = makePnt(oc, x0 + r, y0, z);
  const p2 = makePnt(oc, x1 - r, y0, z);
  const p3 = makePnt(oc, x1, y0 + r, z);
  const p4 = makePnt(oc, x1, y1 - r, z);
  const p5 = makePnt(oc, x1 - r, y1, z);
  const p6 = makePnt(oc, x0 + r, y1, z);
  const p7 = makePnt(oc, x0, y1 - r, z);
  const p8 = makePnt(oc, x0, y0 + r, z);

  const diag = r / Math.sqrt(2);
  const midTR = makePnt(oc, x1 - r + diag, y0 + r - diag, z);
  const midBR = makePnt(oc, x1 - r + diag, y1 - r + diag, z);
  const midBL = makePnt(oc, x0 + r - diag, y1 - r + diag, z);
  const midTL = makePnt(oc, x0 + r - diag, y0 + r - diag, z);

  const e1 = makeEdgeLine(oc, p1, p2);
  const e2 = makeEdgeArc(oc, p2, midTR, p3);
  const e3 = makeEdgeLine(oc, p3, p4);
  const e4 = makeEdgeArc(oc, p4, midBR, p5);
  const e5 = makeEdgeLine(oc, p5, p6);
  const e6 = makeEdgeArc(oc, p6, midBL, p7);
  const e7 = makeEdgeLine(oc, p7, p8);
  const e8 = makeEdgeArc(oc, p8, midTL, p1);

  const wire = makeWireFromEdges(oc, [e1, e2, e3, e4, e5, e6, e7, e8]);
  debugLog("roundedRect wire", { type: wire?.constructor?.name });
  try {
    const face = makeFaceFromWire(oc, wire);
    debugLog("roundedRect face", { type: face?.constructor?.name });
    return makePrism(oc, face, height);
  } catch {
    return makePipeFromWire(oc, wire, height, z);
  }
};

const buildBox = (oc: any, params: ShapeParams) => {
  const { wall, top, bottom } = resolveThickness(params);
  const topThickness = 0;

  const outerWidth = params.insideWidth + wall * 2;
  const outerDepth = params.insideDepth + wall * 2;
  const outerHeight = params.insideHeight + bottom + topThickness;


  const innerRadius = params.includeInsideRadius ? params.insideRadius : 0;
  const inner = buildRoundedRectPrism(
    oc,
    wall,
    wall,
    bottom,
    params.insideWidth,
    params.insideDepth,
    params.insideHeight,
    innerRadius
  );
  const outerRadius = params.includeInsideRadius ? params.insideRadius + wall : 0;
  const outerShell = buildRoundedRectPrism(
    oc,
    0,
    0,
    0,
    outerWidth,
    outerDepth,
    outerHeight,
    outerRadius
  );

  return cutShape(oc, outerShell, inner);
};

const buildCylinder = (oc: any, params: ShapeParams) => {
  const { wall, top, bottom } = resolveThickness(params);
  const topThickness = params.includeLid ? 0 : top;

  const innerRadius = params.insideWidth / 2;
  const outerRadius = innerRadius + wall;
  const outerHeight = params.insideHeight + bottom + topThickness;

  const inner = makeCylinderAt(oc, innerRadius, params.insideHeight, 0, 0, bottom);
  const outer = makeCylinderAt(oc, outerRadius, outerHeight, 0, 0, 0);

  return cutShape(oc, outer, inner);
};

const buildRoundedInnerTool = (oc: any, params: ShapeParams) => {
  const { wall, bottom } = resolveThickness(params);
  if (!params.includeInsideRadius) {
    return null;
  }
  return buildRoundedRectPrism(
    oc,
    wall,
    wall,
    bottom,
    params.insideWidth,
    params.insideDepth,
    params.insideHeight,
    params.insideRadius
  );
};

const buildLid = (
  oc: any,
  params: ShapeParams,
  baseOuter: { width: number; depth: number }
) => {
  const { wall, top, bottom } = resolveThickness(params);
  const clearance = params.clearance;
  const innerWidth = baseOuter.width + clearance * 2;
  const innerDepth = baseOuter.depth + clearance * 2;
  const lidHeight = params.insideHeight + bottom + top;
  const outerWidth = innerWidth + wall * 2;
  const outerDepth = innerDepth + wall * 2;

  if (params.shape === "cylinder") {
    const innerRadius = innerWidth / 2;
    const outerRadius = innerRadius + wall;
    const outer = makeCylinderAt(oc, outerRadius, lidHeight, 0, 0, 0);
    const inner = makeCylinderAt(oc, innerRadius, lidHeight - top, 0, 0, 0);
    const lid = cutShape(oc, outer, inner);
    return translateShape(oc, lid, -(clearance + wall), -(clearance + wall), 0);
  }

  const baseOuterRadius = params.includeInsideRadius
    ? params.insideRadius + wall
    : 0;
  const innerRadius = baseOuterRadius + clearance;
  const outerRadius = innerRadius + wall;

  const outer = buildRoundedRectPrism(
    oc,
    0,
    0,
    0,
    outerWidth,
    outerDepth,
    lidHeight,
    outerRadius
  );
  const inner = buildRoundedRectPrism(
    oc,
    wall,
    wall,
    0,
    innerWidth,
    innerDepth,
    lidHeight - top,
    innerRadius
  );
  const lid = cutShape(oc, outer, inner);
  return translateShape(oc, lid, -(clearance + wall), -(clearance + wall), 0);
};

export const buildStepFile = async (params: ShapeParams) => {
  const oc = await getOc();
  const base = params.shape === "cylinder" ? buildCylinder(oc, params) : buildBox(oc, params);

  if (!params.includeLid) {
    return writeStep(oc, base);
  }

  const { wall } = resolveThickness(params);
  const baseOuterWidth = params.insideWidth + wall * 2;
  const baseOuterDepth =
    params.shape === "cylinder" ? baseOuterWidth : params.insideDepth + wall * 2;
  const baseOuter = {
    width: baseOuterWidth,
    depth: baseOuterDepth
  };

  const lid = buildLid(oc, params, baseOuter);
  const compound = makeCompound(oc, [base, lid]);
  return writeStep(oc, compound);
};

export const buildDebugInnerTool = async (params: ShapeParams) => {
  if (params.shape !== "box" || !params.includeInsideRadius) {
    return null;
  }
  const oc = await getOc();
  const tool = buildRoundedInnerTool(oc, params);
  if (!tool) {
    return null;
  }
  return writeStep(oc, tool);
};
