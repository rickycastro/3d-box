// Svelte store holding the (always hard-clamped) params, plus:
//  - URL <-> params sync (bookmarkable / shareable configs)
//  - a derived validation-error store
//
// The store never holds garbage (NaN / out-of-absolute-range) because every
// set/update is routed through clamp(). It CAN hold cross-parameter-invalid
// combinations — that's what the derived `errors` store is for.

import { derived, writable, get } from 'svelte/store';
import {
  DEFAULTS,
  URL_KEYS,
  type ParamKey,
  type SnapBoxParams,
} from '../geometry/types';
import { clamp, validate } from '../geometry/validate';

/** Parse location.search over DEFAULTS, keep finite numbers, then hard-clamp. */
export function parseParamsFromUrl(search: string): SnapBoxParams {
  const q = new URLSearchParams(search);
  const merged: SnapBoxParams = { ...DEFAULTS };
  for (const key of Object.keys(URL_KEYS) as ParamKey[]) {
    const raw = q.get(URL_KEYS[key]);
    if (raw === null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) merged[key] = n;
  }
  return clamp(merged);
}

export function paramsToSearch(params: SnapBoxParams): string {
  const q = new URLSearchParams();
  for (const key of Object.keys(URL_KEYS) as ParamKey[]) {
    q.set(URL_KEYS[key], String(params[key]));
  }
  return q.toString();
}

function createParamsStore() {
  const initial =
    typeof location !== 'undefined'
      ? parseParamsFromUrl(location.search)
      : { ...DEFAULTS };
  const store = writable<SnapBoxParams>(initial);

  return {
    subscribe: store.subscribe,
    /** Set one field (clamped). */
    setField(key: ParamKey, value: number) {
      store.update((p) => clamp({ ...p, [key]: value }));
    },
    set(params: SnapBoxParams) {
      store.set(clamp(params));
    },
    reset() {
      store.set({ ...DEFAULTS });
    },
    get: () => get(store),
  };
}

export const params = createParamsStore();

/** Derived list of tier-2 validation errors; drives field highlighting + build gate. */
export const errors = derived(params, ($p) => validate($p));

/** True when the current params are safe to build. */
export const isValid = derived(errors, ($e) => $e.length === 0);

/** Convenience: map of param key -> first error message touching it. */
export const errorByKey = derived(errors, ($errors) => {
  const map = {} as Partial<Record<ParamKey, string>>;
  for (const e of $errors) {
    for (const k of e.keys) {
      if (!map[k]) map[k] = e.message;
    }
  }
  return map;
});

let debounceUrl: ReturnType<typeof setTimeout> | undefined;

/**
 * Start syncing params -> URL (history.replaceState, debounced). Always runs,
 * regardless of validity, so a broken bookmark reproduces the same error state
 * rather than being silently "fixed". Returns an unsubscribe fn.
 */
export function startUrlSync(delay = 200): () => void {
  return params.subscribe((p) => {
    if (typeof history === 'undefined') return;
    clearTimeout(debounceUrl);
    debounceUrl = setTimeout(() => {
      const url = `${location.pathname}?${paramsToSearch(p)}`;
      history.replaceState(null, '', url);
    }, delay);
  });
}
