import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  type ShapeParams,
  normalizeParamsForCad,
  parseParams,
  paramsToSearch,
  roundTo
} from "./lib/params";
import { buildDebugInnerTool, buildStepAndPreviewMesh, type PreviewMeshes } from "./lib/cad";
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
  const [previewMesh, setPreviewMesh] = useState<PreviewMeshes | null>(null);
  const [stepData, setStepData] = useState<Uint8Array | null>(null);
  const [showBox, setShowBox] = useState(true);
  const [showLid, setShowLid] = useState(true);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const meshRefs = useRef<{ box?: THREE.Object3D; lid?: THREE.Object3D }>({});

  const effectiveParams = useMemo(() => normalizeParamsForCad(params), [params]);

  const didInitCamera = useRef(false);

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

  useEffect(() => {
    setPreviewMesh(null);
    setStepData(null);
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
    setPreviewMesh(null);
    setStepData(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = await buildStepAndPreviewMesh(params);
      setPreviewMesh(result.mesh);
      setStepData(result.step);
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

  const handleDownload = () => {
    setError(null);
    if (!stepData) {
      setError("Generate a preview before downloading.");
      return;
    }
    downloadBlob(stepData, "box.step");
  };

  useEffect(() => {
    const container = previewRef.current;
    if (!container || !previewMesh) {
      return;
    }

    didInitCamera.current = false;

    const width = container.clientWidth;
    const height = 320;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const meshMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e2dc,
      metalness: 0.08,
      roughness: 0.6,
      side: THREE.DoubleSide
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x315a73,
      transparent: true,
      opacity: 0.65
    });

    const makeMesh = (data: { positions: number[]; indices: number[] }) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.positions, 3)
      );
      geometry.setIndex(data.indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, meshMaterial);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        edgeMaterial
      );
      const group = new THREE.Group();
      group.add(mesh);
      group.add(edges);
      modelGroup.add(group);
      return { group, geometry };
    };

    const boxGroup = makeMesh(previewMesh.box);
    meshRefs.current.box = boxGroup.group;
    if (previewMesh.lid) {
      const lidGroup = makeMesh(previewMesh.lid);
      meshRefs.current.lid = lidGroup.group;
    } else {
      meshRefs.current.lid = undefined;
    }

    const grid = new THREE.GridHelper(200, 20, 0x8aa3b0, 0xd8d0c8);
    grid.position.y = -0.001;
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(120, 160, 80);
    scene.add(key);

    modelGroup.rotation.x = -Math.PI / 2;
    modelGroup.updateMatrixWorld();
    const worldBox = new THREE.Box3().setFromObject(modelGroup);
    if (worldBox.isEmpty() === false) {
      const center = new THREE.Vector3();
      worldBox.getCenter(center);
      const offsetX = -center.x;
      const offsetZ = -center.z;
      const lift = -worldBox.min.y;
      modelGroup.position.set(offsetX, lift, offsetZ);
    }
    modelGroup.updateMatrixWorld();

    if (!didInitCamera.current) {
      const box = new THREE.Box3().setFromObject(modelGroup);
      if (box.isEmpty() === false) {
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const maxSize = Math.max(size.x, size.y, size.z, 1);
        const distance = maxSize * 1.4;
        camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
        didInitCamera.current = true;
      }
    }

    let frameId = 0;
    const onFrame = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(onFrame);
    };
    onFrame();

    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = 320;
      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    modelGroupRef.current = modelGroup;

    meshRefs.current.box.visible = showBox;
    if (meshRefs.current.lid) {
      meshRefs.current.lid.visible = showLid;
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameId);
      controls.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      meshMaterial.dispose();
      edgeMaterial.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelGroupRef.current = null;
      meshRefs.current = {};
    };
  }, [previewMesh]);

  useEffect(() => {
    const box = meshRefs.current.box;
    if (box) {
      box.visible = showBox;
    }
    const lid = meshRefs.current.lid;
    if (lid) {
      lid.visible = showLid;
    }
  }, [showBox, showLid]);

  const set = <K extends keyof ShapeParams>(key: K, value: ShapeParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };


  return (
    <div className="min-h-screen px-6 py-10 text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            3D Box Builder
          </h1>
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

              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-ocean px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-ocean/90 disabled:opacity-60"
                  onClick={handleGenerate}
                  disabled={status === "loading"}
                  type="button"
                >
                  {status === "loading" ? "Generating..." : "Preview"}
                </button>
                {stepData && (
                  <button
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-ocean px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-ocean/90 disabled:opacity-60"
                    onClick={handleDownload}
                    disabled={status === "loading"}
                    type="button"
                  >
                    Download STEP
                  </button>
                )}
              </div>
              {status === "error" && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-sand/70 bg-white/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">3D Preview</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink/70">
                  <span className="text-xs uppercase tracking-[0.18em]">Show</span>
                  <button
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      showBox ? "bg-ocean text-white" : "border border-sand/70"
                    }`}
                    onClick={() => setShowBox((prev) => !prev)}
                    type="button"
                  >
                    Box
                  </button>
                  <button
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      showLid ? "bg-ocean text-white" : "border border-sand/70"
                    } ${!params.includeLid ? "opacity-40" : ""}`}
                    onClick={() => setShowLid((prev) => !prev)}
                    type="button"
                    disabled={!params.includeLid}
                  >
                    Lid
                  </button>
                </div>
              </div>
              <div className="relative mt-4 h-80 rounded-2xl border border-sand/60 bg-porcelain/80">
                <div ref={previewRef} className="h-full w-full" />
                {!previewMesh && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-ink/60">
                    Click Preview to see the interactive model.
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-[28px] border border-sand/70 bg-white/70 p-6">
              <h2 className="text-lg font-semibold text-ink">Outer Size</h2>
              <div className="mt-4 grid gap-2 text-sm text-ink/70">
                <div>Width: {outerDims.width} mm</div>
                <div>Depth: {outerDims.depth} mm</div>
                <div>Height: {outerDims.height} mm</div>
              </div>
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
