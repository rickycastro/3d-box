<script lang="ts">
  import { get } from 'svelte/store';
  import { params, isValid } from '../stores/params';
  import { hasRendered } from '../stores/status';
  import { cad } from '../worker/workerClient';
  import type { PartName } from '../worker/cad.worker';

  let busy = $state(false);

  // Export must be gated the same way builds are: never export known-invalid
  // geometry, and not before the first successful render exists to fall back on.
  let disabled = $derived(!$isValid || !$hasRendered || busy);

  async function download(format: 'step' | 'stl', part: PartName) {
    if (disabled) return;
    busy = true;
    try {
      const { blob, filename } = await cad.export(get(params), format, part);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      busy = false;
    }
  }
</script>

<div class="exports">
  <div class="group">
    <span class="glabel">Tray</span>
    <button {disabled} onclick={() => download('step', 'tray')}>STEP</button>
    <button {disabled} onclick={() => download('stl', 'tray')}>STL</button>
  </div>
  <div class="group">
    <span class="glabel">Lid</span>
    <button {disabled} onclick={() => download('step', 'lid')}>STEP</button>
    <button {disabled} onclick={() => download('stl', 'lid')}>STL</button>
  </div>
</div>

<style>
  .exports {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .glabel {
    font-size: 12px;
    font-weight: 500;
    width: 34px;
    color: var(--color-text-muted);
  }
  button {
    flex: 1;
    font-size: 12px;
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: #fff;
    color: var(--color-text);
    transition: background 0.12s, border-color 0.12s;
  }
  button:not(:disabled):hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
