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

  // Custom steppers (the native ::-webkit-inner-spin-button can't be made to
  // reliably fill the field height). One step per click, clamped to the range.
  function bump(dir: 1 | -1) {
    const step = range.step || 1;
    const start = Number.isFinite(value) ? value : range.min;
    let v = Math.min(range.max, Math.max(range.min, start + dir * step));
    v = parseFloat(v.toFixed(4)); // kill float drift (e.g. 0.1 + 0.2)
    onchange(v);
  }
</script>

<div class="field" class:has-error={!!error}>
  <div class="row">
    <label for={`f-${range.label}`}>
      {range.label}{#if range.unit}<span class="unit">&nbsp;({range.unit})</span>{/if}
    </label>
    <div class="input-wrap">
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
      <div class="steppers">
        <button type="button" class="up" tabindex="-1" aria-label="Increase" onclick={() => bump(1)}
        ></button>
        <button type="button" class="down" tabindex="-1" aria-label="Decrease" onclick={() => bump(-1)}
        ></button>
      </div>
    </div>
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

  /* The field outline lives on the wrapper so the input + steppers sit inside it;
     the steppers then align exactly to the field border, full height. */
  .input-wrap {
    display: flex;
    align-items: stretch;
    width: 64px;
    height: 24px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: #f5f5f5;
    overflow: hidden;
  }
  .input-wrap:hover {
    border-color: var(--color-border);
  }
  .input-wrap:focus-within {
    background: #fff;
    border-color: var(--color-accent);
  }
  .has-error .input-wrap {
    border-color: var(--color-error);
  }

  .num {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    /* 11px on desktop; bumped to 16px on touch (below) to dodge iOS focus-zoom. */
    font-size: 11px;
    padding: 0 4px 0 6px;
    text-align: right;
    color: var(--color-text);
    -webkit-appearance: textfield;
    appearance: textfield;
  }
  .num:focus {
    outline: none;
  }
  .num::-webkit-inner-spin-button,
  .num::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .steppers {
    display: flex;
    flex-direction: column;
    width: 16px;
    flex: 0 0 16px;
  }
  .steppers button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    outline: none;
    background: transparent;
    color: var(--color-caret);
    padding: 0;
    cursor: pointer;
  }
  .steppers button:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--color-accent);
  }
  /* Chevron carets drawn from two borders: geometrically centered in each half,
     unlike caret glyphs which sit at the edges of their em box. A small
     margin biases each toward the field center for edge clearance. */
  .steppers button::before {
    content: '';
    width: 4px;
    height: 4px;
    border: solid currentColor;
    border-width: 1.1px 1.1px 0 0;
  }
  .steppers .up::before {
    transform: rotate(-45deg);
    margin-top: 2px;
  }
  .steppers .down::before {
    transform: rotate(135deg);
    margin-bottom: 2px;
  }

  .err {
    margin: 0;
    font-size: 10px;
    color: var(--color-error);
    line-height: 1.3;
  }

  @media (pointer: coarse) {
    .input-wrap {
      height: 30px;
      width: 74px;
    }
    .num {
      font-size: 16px;
    }
    .steppers {
      width: 22px;
      flex-basis: 22px;
    }
    .steppers button {
      font-size: 9px;
    }
  }
</style>
