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

  const format = (v: number): string => (Number.isFinite(v) ? String(v) : '');

  // Uncommitted edit text; null when not editing, so the field otherwise mirrors
  // `value` (external changes from clamp, reset, URL sync flow straight through).
  let draft = $state<string | null>(null);
  const display = $derived(draft ?? format(value));

  /**
   * Adobe-style arithmetic: evaluate a simple expression typed into the field
   * (e.g. `100/2`, `20+3.5`, `(75-1)/2`). Only digits, the four operators,
   * parentheses, decimal points and whitespace are permitted — anything else
   * (letters, etc.) returns null and the field reverts to its last good value.
   */
  function evaluate(raw: string): number | null {
    const s = raw.trim();
    if (!s) return null;
    if (!/^[0-9.+\-*/()\s]+$/.test(s)) return null;
    try {
      const v = Function(`"use strict";return (${s});`)();
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  function commit() {
    if (draft === null) return;
    const v = evaluate(draft);
    draft = null; // revert to `value` (updated below if parseable & unclamped)
    if (v !== null) onchange(v);
  }
</script>

<!-- The field outline lives on the wrapper for consistency with the focus/error
     states shared across the panel. -->
<div class="input-wrap" class:invalid>
  <input
    id={`f-${range.label}`}
    class="num"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    spellcheck="false"
    aria-label={range.label}
    value={display}
    oninput={(e) => (draft = e.currentTarget.value)}
    onblur={commit}
    onkeydown={(e) => {
      if (e.key === 'Enter') e.currentTarget.blur();
    }}
  />
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
    padding: 0 6px;
    text-align: right;
    color: var(--color-text);
  }
  .num:focus {
    outline: none;
  }

  @media (pointer: coarse) {
    .input-wrap {
      height: 30px;
      width: 74px;
    }
    .num {
      font-size: 16px;
    }
  }
</style>
