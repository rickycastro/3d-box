// Main-thread wrapper around the CAD worker: promise-per-requestId, with stale
// build responses discarded so a fast slider drag never lets a slow older build
// clobber a newer one.

import CadWorker from './cad.worker?worker';
import type {
  BuildResponse,
  ExportResponse,
  PartMesh,
  PartName,
  WorkerRequest,
  WorkerResponse,
} from './cad.worker';
import type { SnapBoxParams } from '../geometry/types';

export interface BuildResult {
  tray: PartMesh;
  lid: PartMesh;
}

type Pending = {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
};

class WorkerClient {
  private worker: Worker;
  private nextId = 1;
  private latestBuildId = 0;
  private pending = new Map<number, Pending>();
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;

  /** Resolves once OpenCascade has initialised in the worker. */
  readonly ready: Promise<void>;

  /** Optional hook for unexpected runtime (non-validation) worker errors. */
  onRuntimeError?: (message: string) => void;

  constructor() {
    this.worker = new CadWorker();
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) =>
      this.handleMessage(e.data);
    this.worker.onerror = (e) => {
      const msg = e.message || 'CAD worker crashed';
      this.readyReject(new Error(msg));
      this.onRuntimeError?.(msg);
    };
  }

  private handleMessage(msg: WorkerResponse) {
    switch (msg.type) {
      case 'ready':
        this.readyResolve();
        return;
      case 'error': {
        if (msg.requestId !== undefined && this.pending.has(msg.requestId)) {
          this.pending.get(msg.requestId)!.reject(new Error(msg.message));
          this.pending.delete(msg.requestId);
        } else {
          this.readyReject(new Error(msg.message));
          this.onRuntimeError?.(msg.message);
        }
        return;
      }
      case 'build':
      case 'export': {
        const p = this.pending.get(msg.requestId);
        if (!p) return; // stale / already superseded
        this.pending.delete(msg.requestId);
        p.resolve(msg);
        return;
      }
    }
  }

  private send<T extends WorkerResponse>(req: WorkerRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req.requestId, { resolve, reject });
      this.worker.postMessage(req);
    });
  }

  /**
   * Build meshes for the given params. If a newer build is requested before this
   * one resolves, this promise rejects with a benign `StaleBuild` marker so the
   * caller can ignore it.
   */
  async build(params: SnapBoxParams): Promise<BuildResult> {
    const requestId = this.nextId++;
    this.latestBuildId = requestId;
    const res = await this.send<BuildResponse>({ type: 'build', requestId, params });
    if (requestId !== this.latestBuildId) {
      throw new StaleBuild();
    }
    return { tray: res.tray, lid: res.lid };
  }

  async export(
    params: SnapBoxParams,
    format: 'step' | 'stl',
    part: PartName,
  ): Promise<{ blob: Blob; filename: string }> {
    const requestId = this.nextId++;
    const res = await this.send<ExportResponse>({
      type: 'export',
      requestId,
      params,
      format,
      part,
    });
    return { blob: res.blob, filename: res.filename };
  }
}

export class StaleBuild extends Error {
  constructor() {
    super('stale build superseded by a newer request');
    this.name = 'StaleBuild';
  }
}

export const isStaleBuild = (err: unknown): err is StaleBuild =>
  err instanceof StaleBuild;

// One shared client for the whole app.
export const cad = new WorkerClient();
