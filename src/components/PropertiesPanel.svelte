<script lang="ts">
  import { params, errors, errorByKey } from '../stores/params';
  import { RANGES, type NumericParamKey } from '../geometry/types';
  import ParamField from './ParamField.svelte';
  import ToggleField from './ToggleField.svelte';
  import ExportButtons from './ExportButtons.svelte';

  // All numeric dimension fields, shown together. The thumb-notch and snap
  // toggles (each with its own field) are appended after these in the template.
  const FIELDS: NumericParamKey[] = ['w', 'l', 'h', 'wDivisions', 'lDivisions', 'thickness', 'clearance'];
</script>

<div class="panel">
  {#if $errors.length}
    <div class="banner">Doesn't fit — adjust the highlighted fields.</div>
  {/if}

  <div class="fields">
    {#each FIELDS as key (key)}
      <ParamField
        value={$params[key]}
        range={RANGES[key]}
        error={$errorByKey[key]}
        onchange={(v) => params.setField(key, v)}
      />
    {/each}
    <ToggleField
      label="Thumb notch"
      checked={$params.notch}
      onToggle={(v) => params.setToggle('notch', v)}
      value={$params.thumbDiameter}
      range={RANGES.thumbDiameter}
      error={$errorByKey.thumbDiameter}
      onValueChange={(v) => params.setField('thumbDiameter', v)}
    />
    <ToggleField
      label="Snap lid"
      checked={$params.snap}
      onToggle={(v) => params.setToggle('snap', v)}
      value={$params.snapDepth}
      range={RANGES.snapDepth}
      error={$errorByKey.snapDepth}
      onValueChange={(v) => params.setField('snapDepth', v)}
    />
  </div>

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
  .divider {
    height: 1px;
    background: var(--color-border);
    /* Full panel width: cancel the panel's horizontal padding. */
    margin: 10px calc(-1 * var(--pad-x));
  }
</style>
