// UI status flags for the CAD pipeline, kept separate from the param state.
import { writable } from 'svelte/store';

/** True until OpenCascade has initialised + the first successful build renders. */
export const booting = writable(true);
/** True while a build is in flight (for a subtle busy indicator). */
export const building = writable(false);
/** Set on an unexpected (non-validation) worker/runtime failure. */
export const runtimeError = writable<string | null>(null);
/** True once at least one successful build has rendered (gates export). */
export const hasRendered = writable(false);
