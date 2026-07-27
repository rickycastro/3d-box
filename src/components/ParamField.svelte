<script lang="ts">
  import type { Range } from '../geometry/types';

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

  function emit(raw: string) {
    const v = parseFloat(raw);
    if (Number.isFinite(v)) onchange(v);
  }
</script>

<div class="field" class:has-error={!!error}>
  <div class="row">
    <label for={`f-${range.label}`}>
      {range.label}{#if range.unit}<span class="unit"> ({range.unit})</span>{/if}
    </label>
    <input
      id={`f-${range.label}`}
      class="num"
      type="number"
      min={range.min}
      max={range.max}
      step={range.step}
      {value}
      oninput={(e) => emit(e.currentTarget.value)}
    />
  </div>
  <input
    class="slider"
    type="range"
    min={range.min}
    max={range.max}
    step={range.step}
    {value}
    oninput={(e) => emit(e.currentTarget.value)}
  />
  {#if error}
    <p class="err">{error}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px 0;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  label {
    font-size: 12px;
    color: var(--color-text);
    font-weight: 500;
  }
  .unit {
    color: var(--color-text-muted);
    font-weight: 400;
  }
  .num {
    width: 68px;
    /* 16px text avoids iOS Safari's focus auto-zoom. Keep the field compact via
       tight padding/height, NOT transform:scale (which desyncs hit targets). */
    font-size: 16px;
    padding: 3px 6px;
    text-align: right;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: #fff;
    color: var(--color-text);
  }
  .num:focus {
    outline: none;
    border-color: var(--color-accent);
  }
  .slider {
    width: 100%;
    accent-color: var(--color-accent);
    margin: 0;
  }
  .has-error .num {
    border-color: var(--color-error);
  }
  .err {
    margin: 0;
    font-size: 11px;
    color: var(--color-error);
    line-height: 1.3;
  }
</style>
