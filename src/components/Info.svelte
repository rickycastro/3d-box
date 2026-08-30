<script lang="ts">
  import { params } from '../stores/params';
  import { outerDimensions, type OuterSize } from '../geometry/types';

  // Collapsed by default: the panel's editable fields are all INNER dimensions,
  // and these are read-only derived output — useful when checking plate fit, but
  // not something to keep in the way.
  let open = $state(false);

  // "Tray" / "Lid" rather than bottom / top, matching the download button labels
  // and the exported filenames (box-tray-…, box-lid-…).

  const sizes = $derived(outerDimensions($params));

  /** Trim float noise (e.g. 78.34000000000001) without padding whole numbers. */
  const mm = (v: number): string => String(Math.round(v * 100) / 100);
  const size = (s: OuterSize): string => `${mm(s.w)} × ${mm(s.l)} × ${mm(s.h)}`;
</script>

<div class="info">
  <button
    type="button"
    class="summary"
    aria-expanded={open}
    aria-controls="info-rows"
    onclick={() => (open = !open)}
  >
    <svg class="caret" class:open viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M4.5 2.5 L8 6 L4.5 9.5" fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    Info
  </button>

  {#if open}
    <dl id="info-rows" class="rows">
      <dt>Tray<span class="unit">&nbsp;(outer)</span></dt>
      <dd>{size(sizes.tray)}<span class="unit">&nbsp;mm</span></dd>
      <dt>Lid<span class="unit">&nbsp;(outer)</span></dt>
      <dd>{size(sizes.lid)}<span class="unit">&nbsp;mm</span></dd>
    </dl>
  {/if}
</div>

<style>
  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
  }
  .summary {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 24px;
    padding: 0;
    border: none;
    background: none;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text);
    text-align: left;
  }
  .summary:hover .caret {
    color: var(--color-text);
  }
  .summary:focus-visible {
    outline: 2px solid var(--color-caret);
    outline-offset: 2px;
    border-radius: 3px;
  }
  .caret {
    flex: 0 0 auto;
    color: var(--color-caret);
    transition: transform 0.12s ease;
  }
  .caret.open {
    transform: rotate(90deg);
  }

  /* Two-column label/value grid, indented to line up under the caret's label. */
  .rows {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: baseline;
    gap: 2px 10px;
    margin: 2px 0 2px 16px;
  }
  dt {
    font-size: 11px;
    color: var(--color-text);
  }
  dd {
    margin: 0;
    font-size: 11px;
    color: var(--color-text);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    color: var(--color-text-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .caret {
      transition: none;
    }
  }
</style>
