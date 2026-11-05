/** One-click linking: remembers a link code across the Google/Microsoft redirect. */
export type LinkProvider = "google" | "microsoft";
type Pending = { code: string; provider: LinkProvider; at: number };

const KEY = "carterhub.pending-link";
const MAX_AGE_MS = 10 * 60 * 1000; // link codes expire after 10 minutes

export function savePendingLink(store: Storage, code: string, provider: LinkProvider, now = Date.now()) {
  store.setItem(KEY, JSON.stringify({ code, provider, at: now } satisfies Pending));
}

/** Returns the pending code once and always clears it (single use, expired codes dropped). */
export function takePendingLink(store: Storage, now = Date.now()): Pending | null {
  const raw = store.getItem(KEY);
  store.removeItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Pending;
    if (typeof p.code !== "string" || now - p.at > MAX_AGE_MS) return null;
    return p;
  } catch { return null; }
}

export function hasPendingLink(store: Storage) { return store.getItem(KEY) !== null; }
