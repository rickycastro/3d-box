<script lang="ts">
  import TopBar from './components/TopBar.svelte';
  import Viewport from './components/Viewport.svelte';
  import PropertiesPanel from './components/PropertiesPanel.svelte';

  // Mobile bottom-sheet expand/collapse (v1: tap the handle, CSS transition).
  let sheetOpen = $state(true);
</script>

<div class="app">
  <TopBar />
  <main>
    <div class="viewport-wrap">
      <Viewport />
    </div>

    <!-- Desktop: floating top-right panel. Mobile: bottom sheet. -->
    <aside class="panel-host" class:open={sheetOpen}>
      <button
        class="handle"
        onclick={() => (sheetOpen = !sheetOpen)}
        aria-label="Toggle properties panel"
      ></button>
      <div class="panel-scroll">
        <PropertiesPanel />
      </div>
    </aside>
  </main>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  main {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .viewport-wrap {
    position: absolute;
    inset: 0;
  }

  /* Desktop: floating panel top-right. */
  .panel-host {
    position: absolute;
    top: 16px;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .panel-host .handle {
    display: none;
  }
  .panel-scroll {
    min-height: 0;
    overflow: hidden;
    display: flex;
  }

  /* Mobile: bottom sheet with a drag handle. */
  @media (max-width: 768px) {
    .panel-host {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-panel);
      border-top: 1px solid var(--color-border);
      border-radius: 14px 14px 0 0;
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
      transition: transform 0.25s ease;
      transform: translateY(calc(100% - 44px));
      max-height: 75%;
    }
    .panel-host.open {
      transform: translateY(0);
    }
    .panel-host .handle {
      display: block;
      width: 100%;
      height: 44px;
      background: transparent;
      border: none;
      position: relative;
    }
    .panel-host .handle::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: var(--color-border);
    }
    .panel-scroll {
      overflow-y: auto;
      padding: 0 12px 16px;
    }
    /* On mobile the panel is full-width; let the inner card fill it. */
    .panel-scroll :global(.panel) {
      width: 100%;
      border: none;
      box-shadow: none;
      border-radius: 0;
      padding: 0;
    }
  }
</style>
