// localStorage adapter for mastery. The only place that touches storage; never throws.
// Falls back to an in-memory store (progress lasts for the page view) when storage is unavailable.
import { migrate, emptyState } from '../engine/mastery.js';

export const KEY = 'peppy.mastery';

export function createStore(storage, now = () => Date.now()) {
  let persistent = true;
  const probe = () => {
    try { return storage || null; } catch { return null; }
  };
  let state = emptyState();
  const load = () => {
    const s = probe();
    if (!s) { persistent = false; return; }
    try {
      const raw = s.getItem(KEY);
      if (raw == null) return;
      const res = migrate(JSON.parse(raw), now());
      state = res.state;
      if (res.migrated) save();
    } catch { // unreadable storage or corrupt JSON: start fresh, keep working in memory
      persistent = false;
      state = emptyState();
    }
  };
  function save() {
    const s = probe();
    if (!s || !persistent) return;
    try { s.setItem(KEY, JSON.stringify(state)); } catch { persistent = false; } // quota / private mode
  }
  load();
  return {
    get: () => state,
    set(next) { state = next; save(); },
    reset() { state = emptyState(); const s = probe(); try { if (s) s.removeItem(KEY); } catch { /* ignore */ } },
    isPersistent: () => persistent,
  };
}

/** Browser entry: window.localStorage access itself can throw (blocked cookies), so guard the getter. */
export function browserStore() {
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  return createStore(storage);
}
