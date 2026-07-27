<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { SceneManager } from '../viewer/SceneManager';
  import { params, isValid } from '../stores/params';
  import { cad, isStaleBuild } from '../worker/workerClient';
  import { booting, building, hasRendered, runtimeError } from '../stores/status';

  let canvas: HTMLCanvasElement;
  let scene: SceneManager | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  cad.onRuntimeError = (msg) => {
    runtimeError.set(msg);
    booting.set(false);
  };

  async function rebuild() {
    // Skip building known-invalid geometry — show the last valid render instead.
    if (!get(isValid)) return;
    building.set(true);
    try {
      const result = await cad.build(get(params));
      scene?.setModel(result);
      hasRendered.set(true);
      booting.set(false);
      runtimeError.set(null);
    } catch (e) {
      if (!isStaleBuild(e)) {
        runtimeError.set(e instanceof Error ? e.message : String(e));
      }
    } finally {
      building.set(false);
    }
  }

  onMount(() => {
    scene = new SceneManager(canvas);

    // Stop the boot spinner once OC is up even if the initial params are invalid
    // (so a broken bookmark shows its validation errors instead of hanging).
    cad.ready
      .then(() => {
        if (!get(isValid)) booting.set(false);
      })
      .catch((e) => {
        runtimeError.set(e instanceof Error ? e.message : String(e));
        booting.set(false);
      });

    // Fires immediately (first build) and on every param change, debounced.
    const unsub = params.subscribe(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(rebuild, 200);
    });
    return unsub;
  });

  onDestroy(() => {
    clearTimeout(debounceTimer);
    scene?.dispose();
  });
</script>

<div class="viewport">
  <canvas bind:this={canvas}></canvas>

  {#if $booting}
    <div class="overlay">
      <div class="spinner"></div>
      <p>Loading CAD engine…</p>
    </div>
  {:else if !$isValid && $hasRendered}
    <div class="overlay dim">
      <p class="frozen">Showing last valid model — fix the highlighted fields</p>
    </div>
  {/if}

  {#if $runtimeError}
    <div class="error-banner">⚠ {$runtimeError}</div>
  {/if}

  {#if $building && !$booting}
    <div class="busy">
      <span class="busy-spinner"></span>
      Updating…
    </div>
  {/if}
</div>

<style>
  .viewport {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: var(--color-text-muted);
    font-size: 13px;
    pointer-events: none;
  }
  .overlay.dim {
    background: rgba(240, 240, 240, 0.45);
  }
  .overlay p {
    margin: 0;
  }
  .frozen {
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    box-shadow: var(--shadow-panel);
    color: var(--color-text);
  }
  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .busy {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted);
    box-shadow: var(--shadow-panel);
  }
  .busy-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .error-banner {
    position: absolute;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    max-width: 80%;
    background: var(--color-error-bg);
    border: 1px solid var(--color-error);
    color: var(--color-error);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    font-size: 12px;
  }
</style>
