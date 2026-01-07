import { useEffect, useMemo, useState } from "react";
import {
  type ShapeParams,
  normalizeParamsForCad,
  parseParams,
  paramsToSearch,
  roundTo
} from "./lib/params";
import { buildDebugInnerTool, buildStepFile } from "./lib/cad";
import { downloadBlob } from "./lib/download";

const numberInput =
  "w-full rounded-2xl border border-sand/80 bg-white/80 px-4 py-3 text-sm shadow-sm shadow-sand/40 focus:border-ocean focus:outline-none";

const labelClass = "text-xs uppercase tracking-[0.16em] text-ocean/70";

export default function App() {
  const [params, setParams] = useState<ShapeParams>(() =>
    parseParams(window.location.search)
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const effectiveParams = useMemo(() => normalizeParamsForCad(params), [params]);

  useEffect(() => {
    const onPopState = () => setParams(parseParams(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const search = paramsToSearch(params);
    const url = search.length ? `?${search}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [params]);

  const outerDims = useMemo(() => {
    const t =
      effectiveParams.thicknessMode === "uniform" ? effectiveParams.thickness : null;
    const wall = t ?? effectiveParams.wallThickness;
    const bottom = t ?? effectiveParams.bottomThickness;
    const top = 0;
    const width = effectiveParams.insideWidth + wall * 2;
    const depth = effectiveParams.insideDepth + wall * 2;
    const height = effectiveParams.insideHeight + bottom + top;
    return {
      width: roundTo(width),
      depth: roundTo(depth),
      height: roundTo(height),
      wall,
      bottom,
      top
    };
  }, [effectiveParams]);

  const lidDims = useMemo(() => {
    if (!effectiveParams.includeLid) {
      return null;
    }
    const t =
      effectiveParams.thicknessMode === "uniform" ? effectiveParams.thickness : null;
    const wall = t ?? effectiveParams.wallThickness;
    const top = t ?? effectiveParams.topThickness;
    const width = outerDims.width + effectiveParams.clearance * 2 + wall * 2;
    const depth = outerDims.depth + effectiveParams.clearance * 2 + wall * 2;
    const height = outerDims.height;
    return {
      width: roundTo(width),
      depth: roundTo(depth),
      height: roundTo(height),
      wall,
      top
    };
  }, [effectiveParams, outerDims]);

  const handleGenerate = async () => {
    setStatus("loading");
    setError(null);
    setDebugLog([]);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const data = await buildStepFile(params);
      downloadBlob(data, "box.step");
      if (window.location.search.includes("debug=1")) {
        const debug = await buildDebugInnerTool(params);
        if (debug) {
          downloadBlob(debug, "inner-tool.step");
        }
      }
      setStatus("idle");
    } catch (err) {
      const win = window as unknown as {
        __cadDebug?: Array<{ label: string; payload?: unknown; time: string }>;
      };
      if (win.__cadDebug?.length) {
        const lines = win.__cadDebug.slice(-40).map((entry) => {
          const payload =
            entry.payload !== undefined ? ` ${JSON.stringify(entry.payload)}` : "";
          return `${entry.time} ${entry.label}${payload}`;
        });
        setDebugLog(lines);
      }
      setStatus("error");
      setError(err instanceof Error ? err.message : "Generation failed.");
    }
  };

  const set = <K extends keyof ShapeParams>(key: K, value: ShapeParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const previewCorners = useMemo(() => {
    const size = 180;
    const wall =
      effectiveParams.thicknessMode === "uniform"
        ? effectiveParams.thickness
        : effectiveParams.wallThickness;
    const innerW = effectiveParams.insideWidth;
    const innerD = effectiveParams.insideDepth;
    const outerW = innerW + wall * 2;
    const outerD = innerD + wall * 2;
    const lidInnerW = outerW + effectiveParams.clearance * 2;
    const lidInnerD = outerD + effectiveParams.clearance * 2;
    const lidOuterW = lidInnerW + wall * 2;
    const lidOuterD = lidInnerD + wall * 2;
    const maxSpan = Math.max(lidOuterW, lidOuterD, outerW, outerD, 1);
    const padding = 12;
    const scale = (size - padding * 2) / maxSpan;
    const outer = {
      w: outerW * scale,
      d: outerD * scale,
      r: effectiveParams.includeInsideRadius
        ? Math.min(
            (effectiveParams.insideRadius + wall) * scale,
            (Math.min(outerW, outerD) * scale) / 2
          )
        : 0
    };
    const inner = {
      w: innerW * scale,
      d: innerD * scale,
      r: effectiveParams.includeInsideRadius
        ? Math.min(
            effectiveParams.insideRadius * scale,
            (Math.min(innerW, innerD) * scale) / 2
          )
        : 0
    };
    const lidOuter = {
      w: lidOuterW * scale,
      d: lidOuterD * scale,
      r: effectiveParams.includeInsideRadius
        ? Math.min(
            (effectiveParams.insideRadius + wall + effectiveParams.clearance + wall) * scale,
            (Math.min(lidOuterW, lidOuterD) * scale) / 2
          )
        : 0
    };
    const lidInner = {
      w: lidInnerW * scale,
      d: lidInnerD * scale,
      r: effectiveParams.includeInsideRadius
        ? Math.min(
            (effectiveParams.insideRadius + wall + effectiveParams.clearance) * scale,
            (Math.min(lidInnerW, lidInnerD) * scale) / 2
          )
        : 0
    };
    const offsetX = (size - outer.w) / 2;
    const offsetY = (size - outer.d) / 2;
    return {
      size,
      outer,
      inner,
      lidOuter,
      lidInner,
      offsetX,
      offsetY,
      innerOffsetX: offsetX + wall * scale,
      innerOffsetY: offsetY + wall * scale,
      lidOffsetX: offsetX - (effectiveParams.clearance + wall) * scale,
      lidOffsetY: offsetY - (effectiveParams.clearance + wall) * scale,
      lidInnerOffsetX: offsetX - effectiveParams.clearance * scale,
      lidInnerOffsetY: offsetY - effectiveParams.clearance * scale
    };
  }, [effectiveParams]);

  const roundedPath = (x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    const x0 = x;
    const y0 = y;
    const x1 = x + w;
    const y1 = y + h;
    return [
      `M ${x0 + radius} ${y0}`,
      `L ${x1 - radius} ${y0}`,
      `A ${radius} ${radius} 0 0 1 ${x1} ${y0 + radius}`,
      `L ${x1} ${y1 - radius}`,
      `A ${radius} ${radius} 0 0 1 ${x1 - radius} ${y1}`,
      `L ${x0 + radius} ${y1}`,
      `A ${radius} ${radius} 0 0 1 ${x0} ${y1 - radius}`,
      `L ${x0} ${y0 + radius}`,
      `A ${radius} ${radius} 0 0 1 ${x0 + radius} ${y0}`,
      "Z"
    ].join(" ");
  };

  return (
    <div className="min-h-screen px-6 py-10 text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <span className="text-xs uppercase tracking-[0.35em] text-ocean/60">
            Local STEP Generator
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            3D Box Builder
          </h1>
          <p className="max-w-2xl text-base text-ink/70">
            Tune the inside dimensions, wall strategy, and lid fit. Every input
            syncs to the URL so a bookmark recreates the same model.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-sand/80 bg-white/70 p-8 shadow-soft">
            <div className="grid gap-6">
              <div className="grid gap-3">
                <label className={labelClass}>Lid</label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                      params.includeLid
                        ? "bg-ocean text-white"
                        : "border border-sand/80 text-ink"
                    }`}
                    onClick={() => set("includeLid", true)}
                    type="button"
                  >
                    Include lid
                  </button>
                  <button
                    className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                      !params.includeLid
                        ? "bg-ocean text-white"
                        : "border border-sand/80 text-ink"
                    }`}
                    onClick={() => set("includeLid", false)}
                    type="button"
                  >
                    No lid
                  </button>
                </div>
                <p className="text-xs text-ink/60">
                  Lids are built as full-height sleeves.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className={labelClass}>Inside Width (mm)</label>
                  <input
                    className={numberInput}
                    type="number"
                    min={1}
                    step={0.1}
                    value={params.insideWidth}
                    onChange={(event) =>
                      set("insideWidth", Number(event.target.value))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className={labelClass}>Inside Depth (mm)</label>
                  <input
                    className={numberInput}
                    type="number"
                    min={1}
                    step={0.1}
                    value={params.insideDepth}
                    onChange={(event) =>
                      set("insideDepth", Number(event.target.value))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className={labelClass}>Inside Height (mm)</label>
                  <input
                    className={numberInput}
                    type="number"
                    min={1}
                    step={0.1}
                    value={params.insideHeight}
                    onChange={(event) =>
                      set("insideHeight", Number(event.target.value))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                <label className={labelClass}>Inside Radius</label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        params.includeInsideRadius
                          ? "bg-ocean text-white"
                          : "border border-sand/80 text-ink"
                      }`}
                      onClick={() => set("includeInsideRadius", true)}
                      type="button"
                    >
                      Rounded
                    </button>
                    <button
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        !params.includeInsideRadius
                          ? "bg-ocean text-white"
                          : "border border-sand/80 text-ink"
                      }`}
                      onClick={() => set("includeInsideRadius", false)}
                      type="button"
                    >
                      Square
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className={labelClass}>Inside Radius (mm)</label>
                  <input
                    className={`${numberInput} ${
                      params.includeInsideRadius ? "" : "opacity-50"
                    }`}
                    type="number"
                    min={0}
                    step={0.1}
                    value={params.insideRadius}
                    disabled={!params.includeInsideRadius}
                    onChange={(event) =>
                      set("insideRadius", Number(event.target.value))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <label className={labelClass}>Wall Thickness</label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      params.thicknessMode === "uniform"
                        ? "bg-ocean text-white"
                        : "border border-sand/80 text-ink"
                    }`}
                    onClick={() => set("thicknessMode", "uniform")}
                    type="button"
                  >
                    Uniform
                  </button>
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      params.thicknessMode === "custom"
                        ? "bg-ocean text-white"
                        : "border border-sand/80 text-ink"
                    }`}
                    onClick={() => set("thicknessMode", "custom")}
                    type="button"
                  >
                    Custom
                  </button>
                </div>

                {params.thicknessMode === "uniform" ? (
                  <div className="grid gap-2 md:max-w-xs">
                    <label className={labelClass}>Uniform (mm)</label>
                    <input
                      className={numberInput}
                      type="number"
                      min={0.4}
                      step={0.01}
                      value={params.thickness}
                      onChange={(event) =>
                        set("thickness", Number(event.target.value))
                      }
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <label className={labelClass}>Wall (mm)</label>
                      <input
                        className={numberInput}
                        type="number"
                        min={0.4}
                        step={0.01}
                        value={params.wallThickness}
                        onChange={(event) =>
                          set("wallThickness", Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className={labelClass}>Top (mm)</label>
                      <input
                        className={numberInput}
                        type="number"
                        min={0}
                        step={0.01}
                        value={params.topThickness}
                        onChange={(event) =>
                          set("topThickness", Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className={labelClass}>Bottom (mm)</label>
                      <input
                        className={numberInput}
                        type="number"
                        min={0.4}
                        step={0.01}
                        value={params.bottomThickness}
                        onChange={(event) =>
                          set("bottomThickness", Number(event.target.value))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-2 md:max-w-xs">
                <label className={labelClass}>Clearance (mm)</label>
                <input
                  className={numberInput}
                  type="number"
                  min={0}
                  step={0.01}
                  value={params.clearance}
                  onChange={(event) =>
                    set("clearance", Number(event.target.value))
                  }
                />
              </div>

              <button
                className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-ocean px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-ocean/90 disabled:opacity-60"
                onClick={handleGenerate}
                disabled={status === "loading"}
                type="button"
              >
                {status === "loading" ? "Generating..." : "Download STEP"}
              </button>
              {status === "error" && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-sand/70 bg-white/70 p-6">
              <h2 className="text-lg font-semibold text-ink">Outer Size</h2>
              <div className="mt-4 grid gap-2 text-sm text-ink/70">
                <div>Width: {outerDims.width} mm</div>
                <div>Depth: {outerDims.depth} mm</div>
                <div>Height: {outerDims.height} mm</div>
              </div>
            </div>
            <div className="rounded-[28px] border border-sand/70 bg-white/70 p-6">
              <h2 className="text-lg font-semibold text-ink">Inside Corner Preview</h2>
              <div className="mt-4 flex items-center justify-center">
                <svg width={previewCorners.size} height={previewCorners.size}>
                  {params.includeLid && (
                    <>
                    <path
                      d={roundedPath(
                        previewCorners.lidOffsetX,
                        previewCorners.lidOffsetY,
                        previewCorners.lidOuter.w,
                        previewCorners.lidOuter.d,
                        previewCorners.lidOuter.r
                      )}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                    <path
                      d={roundedPath(
                        previewCorners.lidInnerOffsetX,
                        previewCorners.lidInnerOffsetY,
                        previewCorners.lidInner.w,
                        previewCorners.lidInner.d,
                        previewCorners.lidInner.r
                      )}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                    </>
                  )}
                  <path
                    d={roundedPath(
                      previewCorners.offsetX,
                      previewCorners.offsetY,
                      previewCorners.outer.w,
                      previewCorners.outer.d,
                      previewCorners.outer.r
                    )}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                  <path
                    d={roundedPath(
                      previewCorners.innerOffsetX,
                      previewCorners.innerOffsetY,
                      previewCorners.inner.w,
                      previewCorners.inner.d,
                      previewCorners.inner.r
                    )}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                </svg>
              </div>
              <p className="mt-3 text-xs text-ink/60">
                Solid lines show the outer shell, inside cavity, lid outer, and lid inner.
              </p>
            </div>
            {lidDims && (
              <div className="rounded-[28px] border border-sand/70 bg-white/70 p-6">
                <h2 className="text-lg font-semibold text-ink">Lid Outer Size</h2>
                <div className="mt-4 grid gap-2 text-sm text-ink/70">
                  <div>Width: {lidDims.width} mm</div>
                  <div>Depth: {lidDims.depth} mm</div>
                  <div>Height: {lidDims.height} mm</div>
                </div>
              </div>
            )}
            <div className="rounded-[28px] border border-sand/70 bg-white/70 p-6 text-sm text-ink/70">
              <p>
                Inputs are stored in the URL query string for quick sharing and
                bookmarking.
              </p>
              <p className="mt-3">
                STEP export runs locally in your browser and never hits a server.
              </p>
            </div>
            {debugLog.length > 0 && (
              <div className="rounded-[28px] border border-sand/70 bg-white/70 p-6 text-xs text-ink/70">
                <h3 className="text-sm font-semibold text-ink">Debug Log</h3>
                <pre className="mt-3 whitespace-pre-wrap">
                  {debugLog.join("\n")}
                </pre>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
    const stroke = "#28536b";
    const strokeWidth = 1.25;
