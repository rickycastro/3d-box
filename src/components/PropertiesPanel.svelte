<script lang="ts">
  import { params, errors, errorByKey } from '../stores/params';
  import { PARAM_ORDER, RANGES, type ParamKey } from '../geometry/types';
  import ParamField from './ParamField.svelte';
  import ExportButtons from './ExportButtons.svelte';

  const ADVANCED: ParamKey[] = ['thickness', 'snapDepth', 'clearance', 'thumbDiameter'];
  const mainParams = PARAM_ORDER.filter((k) => !ADVANCED.includes(k));

  // Auto-open the advanced section if one of its fields is invalid, so a hidden
  // error can't leave the user stuck with a frozen viewport and no visible cause.
  let advOpen = $state(false);
  let advError = $derived(ADVANCED.some((k) => $errorByKey[k]));
  $effect(() => {
    if (advError) advOpen = true;
  });
</script>

<div class="panel">
  {#if $errors.length}
    <div class="banner">Doesn't fit — adjust the highlighted fields.</div>
  {/if}

  <div class="fields">
    {#each mainParams as key (key)}
      <ParamField
        value={$params[key]}
        range={RANGES[key]}
        error={$errorByKey[key]}
        onchange={(v) => params.setField(key, v)}
      />
    {/each}
  </div>

  <details class="advanced" bind:open={advOpen}>
    <summary>Advanced</summary>
    <div class="fields">
      {#each ADVANCED as key (key)}
        <ParamField
          value={$params[key]}
          range={RANGES[key]}
          error={$errorByKey[key]}
          onchange={(v) => params.setField(key, v)}
        />
      {/each}
    </div>
  </details>

  <div class="divider"></div>
  <ExportButtons />
</div>

<style>
  .panel {
    --pad-x: 14px;
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-panel);
    padding: 12px var(--pad-x);
    width: 280px;
    max-height: 100%;
    overflow-y: auto;
  }
  .banner {
    background: var(--color-error-bg);
    border: 1px solid var(--color-error);
    color: var(--color-error);
    font-size: 12px;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    margin-bottom: 8px;
  }
  .fields {
    display: flex;
    flex-direction: column;
  }
  .advanced {
    margin-top: 4px;
  }
  .advanced summary {
    cursor: pointer;
    list-style: none;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    padding: 6px 0;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .advanced summary::-webkit-details-marker {
    display: none;
  }
  /* Figma "› Preview"-style disclosure: chevron on the LEFT, rotates when open.
     Drawn from borders (a right-pointing chevron is vertically symmetric) so it
     centers cleanly against the label text. */
  .advanced summary::before {
    content: '';
    width: 4px;
    height: 4px;
    flex: 0 0 auto;
    margin: 0 2px;
    border: solid var(--color-caret);
    border-width: 1.2px 1.2px 0 0;
    transform: rotate(45deg);
    transition: transform 0.15s;
  }
  .advanced[open] summary::before {
    transform: rotate(135deg);
  }
  .advanced summary:hover {
    color: var(--color-text);
  }
  .divider {
    height: 1px;
    background: var(--color-border);
    /* Full panel width: cancel the panel's horizontal padding. */
    margin: 10px calc(-1 * var(--pad-x));
  }
</style>
