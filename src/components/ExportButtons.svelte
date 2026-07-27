<script lang="ts">
  import { get } from 'svelte/store';
  import { params, isValid } from '../stores/params';
  import { hasRendered } from '../stores/status';
  import { cad } from '../worker/workerClient';
  import { exportBaseName } from '../geometry/types';
  import type { PartName } from '../worker/cad.worker';

  let busy = $state(false);
  const PARTS: PartName[] = ['tray', 'lid'];

  // Export is gated like builds: never export known-invalid geometry, and not
  // before the first successful render exists to fall back on.
  let disabled = $derived(!$isValid || !$hasRendered || busy);

  // Same helper the worker uses, so the button shows exactly what downloads.
  const fileName = (part: PartName) => `${exportBaseName($params, part)}.step`;

  async function download(part: PartName) {
    if (disabled) return;
    busy = true;
    try {
      const { blob, filename } = await cad.export(get(params), 'step', part);
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
  {#each ['tray', 'lid'] as const as part (part)}
    <button {disabled} title={fileName(part)} onclick={() => download(part)}>
      Download {fileName(part)}
    </button>
  {/each}
</div>

<style>
  .exports {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }
  button {
    width: 100%;
    font-size: 11px;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: #fff;
    color: var(--color-text);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  button:not(:disabled):hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
