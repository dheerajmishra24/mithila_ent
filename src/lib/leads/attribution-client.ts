// Browser side of lead attribution. On page load, campaign tags and ad click
// ids in the URL are kept in sessionStorage (this tab only, no cookie). They
// leave the browser only when the visitor submits an enquiry form; the click
// ids are then sent only if the visitor ticked the optional ad-measurement box
// (the server drops them otherwise, and so does the database).

const KEY = 'mithila-attribution';
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid'] as const;

export function captureAttribution(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const found: Record<string, string> = {};
    for (const k of PARAMS) {
      const v = q.get(k);
      if (v) found[k] = v.slice(0, 500);
    }
    // The latest ad click in this tab is the one that brought the visitor.
    if (Object.keys(found).length > 0) window.sessionStorage.setItem(KEY, JSON.stringify(found));
  } catch {
    // storage blocked: nothing is kept
  }
}

export function readAttribution(): Record<string, string> {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
