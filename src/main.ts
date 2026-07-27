import './styles/theme.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { startUrlSync } from './stores/params';

// The store already parses location.search on construction (see params.ts).
// Keep the URL in sync from here on.
startUrlSync();

const app = mount(App, { target: document.getElementById('app')! });

export default app;
