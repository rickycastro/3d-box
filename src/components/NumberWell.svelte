<script lang="ts">
  import type { Range } from '../geometry/types';

  let {
    value,
    range,
    invalid = false,
    onchange,
  }: {
    value: number;
    range: Range;
    /** Draw the error border (validation failure on this field). */
    invalid?: boolean;
    onchange: (v: number) => void;
  } = $props();

  function emit(raw: string) {
    const v = parseFloat(raw);
    if (Number.isFinite(v)) onchange(v);
  }

  // Custom steppers (the native ::-webkit-inner-spin-button can't be made to
  // reliably fill the field height). One step per click, clamped to the range.
  function bump(dir: 1 | -1) {
    const start = Number.isFinite(value) ? value : range.min;
    let v: number;
    if (range.bumpStep) {
      // Snap onto the bumpStep grid in the click direction: fields that accept
      // fine typed precision (e.g. dimensions, 0.01mm) still step in whole units,
      // rounding away any fractional part rather than carrying it along.
      const s = range.bumpStep;
      const grid = start / s;
      v =
        dir === 1
          ? (Math.floor(grid + 1e-9) + 1) * s
          : (Math.ceil(grid - 1e-9) - 1) * s;
    } else {
      v = start + dir * (range.step || 1);
    }
    v = Math.min(range.max, Math.max(range.min, v));
    v = parseFloat(v.toFixed(4)); // kill float drift (e.g. 0.1 + 0.2)
    onchange(v);
  }
</script>

<!-- The field outline lives on the wrapper so the input + steppers sit inside it;
     the steppers then align exactly to the field border, full height. -->
<div class="input-wrap" class:invalid>
  <input
    id={`f-${range.label}`}
    class="num"
    type="number"
    aria-label={range.label}
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

<style>
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
  .input-wrap.invalid {
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
