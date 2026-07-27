<script lang="ts">
  let copied = $state(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
    } catch {
      // Fallback: select-less clipboard failure is non-fatal.
    }
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<header class="topbar">
  <h1>Snap-Box Configurator</h1>
  <button class="copy" onclick={copyLink}>
    {copied ? 'Copied!' : 'Copy link'}
  </button>
</header>

<style>
  .topbar {
    height: var(--topbar-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: var(--color-panel);
    border-bottom: 1px solid var(--color-border);
  }
  h1 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .copy {
    background: var(--color-accent);
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 7px 16px;
    font-size: 12px;
    font-weight: 600;
    transition: background 0.12s;
  }
  .copy:hover {
    background: var(--color-accent-hover);
  }
</style>
