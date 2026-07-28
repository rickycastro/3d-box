<script lang="ts">
  import type { Range } from '../geometry/types';
  import NumberWell from './NumberWell.svelte';

  let {
    value,
    range,
    error,
    onchange,
  }: {
    value: number;
    range: Range;
    error?: string;
    onchange: (v: number) => void;
  } = $props();
</script>

<div class="field">
  <div class="row">
    <label for={`f-${range.label}`}>
      {range.label}{#if range.unit}<span class="unit">&nbsp;({range.unit})</span>{/if}
    </label>
    <NumberWell {value} {range} invalid={!!error} {onchange} />
  </div>
  {#if error}
    <p class="err">{error}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 24px;
  }
  label {
    font-size: 11px;
    color: var(--color-text);
    font-weight: 500;
  }
  .unit {
    color: var(--color-text-muted);
    font-weight: 400;
  }
  .err {
    margin: 0;
    font-size: 10px;
    color: var(--color-error);
    line-height: 1.3;
  }
</style>
