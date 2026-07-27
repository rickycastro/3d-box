// three.js scene owner: camera, renderer, OrbitControls, lighting, floor grid,
// and syncing worker mesh buffers into renderable geometry. CAD is Z-up (parts
// sit on the z=0 plane), so we configure the camera/grid accordingly.

import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  GridHelper,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { syncGeometries } from 'replicad-threejs-helper';
import type { BuildResult } from '../worker/workerClient';

const BG = 0xf0f0f0;
const GAP = 8; // mm gap between tray and lid in the side-by-side layout

interface PartView {
  group: Group;
  faces: BufferGeometry;
  lines: BufferGeometry;
}

export class SceneManager {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private controls: OrbitControls;
  private parts: PartView[] = [];
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private hasFramed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new Scene();
    this.scene.background = new Color(BG);

    this.camera = new PerspectiveCamera(45, 1, 0.1, 10000);
    this.camera.up.set(0, 0, 1); // Z-up (CAD convention)
    this.camera.position.set(160, -160, 130);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;

    this.addLighting();
    this.addFloor();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.animate();
  }

  private addLighting() {
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const hemi = new HemisphereLight(0xffffff, 0x999999, 0.6);
    this.scene.add(hemi);
    const key = new DirectionalLight(0xffffff, 1.4);
    key.position.set(120, -80, 200);
    this.scene.add(key);
    const fill = new DirectionalLight(0xffffff, 0.5);
    fill.position.set(-150, 120, 80);
    this.scene.add(fill);
  }

  private addFloor() {
    const grid = new GridHelper(600, 60, 0xc8c8c8, 0xdcdcdc);
    grid.rotation.x = Math.PI / 2; // lay it in the XY plane (Z-up floor)
    (grid.material as LineBasicMaterial).transparent = true;
    (grid.material as LineBasicMaterial).opacity = 0.6;
    this.scene.add(grid);
  }

  /** Convert worker mesh buffers into geometry and place tray + lid side-by-side. */
  setModel(build: BuildResult) {
    if (this.disposed) return;
    // syncGeometries updates in place when passed the previous geometries.
    const prev = this.parts.map((p) => ({ faces: p.faces, lines: p.lines }));
    const synced = syncGeometries([build.tray as any, build.lid as any], prev);

    if (this.parts.length === 0) {
      const faceMat = new MeshStandardMaterial({
        color: 0xdadde0,
        metalness: 0.05,
        roughness: 0.65,
      });
      const lineMat = new LineBasicMaterial({ color: 0x5b5f66, transparent: true, opacity: 0.5 });
      for (const g of synced) {
        const group = new Group();
        group.add(new Mesh(g.faces, faceMat));
        group.add(new LineSegments(g.lines, lineMat));
        this.scene.add(group);
        this.parts.push({ group, faces: g.faces, lines: g.lines });
      }
    } else {
      // geometries were updated in place; refresh stored refs
      synced.forEach((g, i) => {
        this.parts[i].faces = g.faces;
        this.parts[i].lines = g.lines;
      });
    }

    this.layout();
    if (!this.hasFramed) {
      this.frameCamera();
      this.hasFramed = true;
    }
  }

  /** Position tray (left) and lid (right) with a gap, using their bounding boxes. */
  private layout() {
    if (this.parts.length < 2) return;
    const [tray, lid] = this.parts;
    tray.faces.computeBoundingBox();
    lid.faces.computeBoundingBox();
    const tb = tray.faces.boundingBox!;
    const lb = lid.faces.boundingBox!;
    const trayW = tb.max.x - tb.min.x;
    const lidW = lb.max.x - lb.min.x;
    tray.group.position.set(-(trayW / 2 + GAP / 2), 0, 0);
    lid.group.position.set(lidW / 2 + GAP / 2, 0, 0);
  }

  /** Frame the camera + controls target to the whole assembly. */
  frameCamera() {
    const box = new Box3();
    for (const p of this.parts) box.expandByObject(p.group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 50;
    const dist = radius / Math.tan((this.camera.fov * Math.PI) / 360) + radius;

    this.controls.target.copy(center);
    const dir = new Vector3(1, -1, 0.8).normalize();
    this.camera.position.copy(center).addScaledVector(dir, dist * 1.4);
    this.camera.near = Math.max(0.1, dist * 0.01);
    this.camera.far = dist * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const p of this.parts) {
      p.faces.dispose();
      p.lines.dispose();
    }
    this.renderer.dispose();
  }
}
