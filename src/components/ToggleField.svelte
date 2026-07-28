<script lang="ts">
  import type { Range } from '../geometry/types';
  import NumberWell from './NumberWell.svelte';

  let {
    label,
    checked,
    onToggle,
    value,
    range,
    error,
    onValueChange,
  }: {
    label: string;
    checked: boolean;
    onToggle: (v: boolean) => void;
    // Optional numeric field revealed on the right while checked.
    value?: number;
    range?: Range;
    error?: string;
    onValueChange?: (v: number) => void;
  } = $props();

  const id = $derived(`t-${label}`);
  const showField = $derived(checked && range && value !== undefined && onValueChange);
</script>

<div class="field">
  <div class="row">
    <div class="left">
      <input {id} class="cbx" type="checkbox" {checked} onchange={(e) => onToggle(e.currentTarget.checked)} />
      <label for={id}>
        {label}{#if showField && range?.unit}<span class="unit">&nbsp;({range.unit})</span>{/if}
      </label>
    </div>
    {#if showField && range && value !== undefined && onValueChange}
      <NumberWell {value} {range} invalid={!!error} onchange={onValueChange} />
    {/if}
  </div>
  {#if showField && error}
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
  .left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  label {
    font-size: 11px;
    color: var(--color-text);
    font-weight: 500;
    cursor: pointer;
  }
  .unit {
    color: var(--color-text-muted);
    font-weight: 400;
  }
  /* Figma-style checkbox: a small rounded square that fills near-black with a
     white check when on. Neutral throughout — no accent blue. */
  .cbx {
    appearance: none;
    -webkit-appearance: none;
    margin: 0;
    flex: 0 0 auto;
    position: relative;
    width: 14px;
    height: 14px;
    border: 1px solid var(--color-caret);
    border-radius: 3px;
    background: var(--color-panel);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .cbx:hover {
    border-color: var(--color-text-muted);
  }
  /* Lightest fill whose white check still clears WCAG AA non-text contrast
     (3:1, SC 1.4.11): #949494 → 3.03:1. Any lighter fails. */
  .cbx:checked {
    background: #949494;
    border-color: #949494;
  }
  /* Checkmark drawn from two borders on a rotated box. */
  .cbx:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 3px;
    height: 6px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
  .cbx:focus-visible {
    outline: 2px solid var(--color-caret);
    outline-offset: 1px;
  }
  .err {
    margin: 0;
    font-size: 10px;
    color: var(--color-error);
    line-height: 1.3;
  }

  @media (pointer: coarse) {
    .cbx {
      width: 17px;
      height: 17px;
    }
    .cbx:checked::after {
      left: 5px;
      top: 1px;
      width: 4px;
      height: 8px;
    }
  }
</style>
