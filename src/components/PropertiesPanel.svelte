<script lang="ts">
  import { params, errors, errorByKey } from '../stores/params';
  import { PARAM_ORDER, RANGES } from '../geometry/types';
  import ParamField from './ParamField.svelte';
  import ExportButtons from './ExportButtons.svelte';
</script>

<div class="panel">
  {#if $errors.length}
    <div class="banner">Doesn't fit — adjust the highlighted fields.</div>
  {/if}

  <div class="fields">
    {#each PARAM_ORDER as key (key)}
      <ParamField
        value={$params[key]}
        range={RANGES[key]}
        error={$errorByKey[key]}
        onchange={(v) => params.setField(key, v)}
      />
    {/each}
  </div>

  <div class="divider"></div>
  <ExportButtons />
</div>

<style>
  .panel {
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-panel);
    padding: 12px 14px;
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
    margin: 10px 0;
  }
</style>
