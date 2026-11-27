// Shiprocket tracking webhook payload -> the normalised input that
// public.shipment_apply() expects (migration 0055). Pure: no I/O.
//
// Contract (apidocs.shiprocket.in, "Webhooks"): POST, JSON, optional
// security token sent as `x-api-key`, the receiver must answer 200. Sample
// fields: awb, courier_name, current_status, current_status_id,
// shipment_status, shipment_status_id, current_timestamp ("23 05 2023
// 11:43:52"), order_id (the merchant's own order id), sr_order_id, etd
// ("2023-05-23 15:40:19"), is_return (0/1) and scans[] of {date, activity,
// location, status, "sr-status", "sr-status-label"}. Times are Indian time.
//
// Status *labels* drive the logic, not numeric ids: the labels appear in
// the documented sample, the full id table does not.

export interface ShipmentInput {
  awb: string;
  courier_name: string | null;
  status_label: string;
  status_at: string | null;
  etd: string | null;
  is_return: boolean;
  order_ref: string | null;
  scans: { at: string; label: string; activity: string | null; location: string | null }[];
}

const AWB_RE = /^[A-Za-z0-9-]{4,40}$/;
const MAX_SCANS = 200;

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  // Plain text only: these values are shown to customers and put in e-mails.
  const s = String(v).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Shiprocket times as ISO-8601 in IST (+05:30). Accepts "DD MM YYYY HH:mm:ss"
 * (current_timestamp) and "YYYY-MM-DD HH:mm:ss" (scans, etd). Anything else,
 * or an impossible date, gives null.
 */
export function parseShiprocketTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let y: string, mo: string, d: string, h: string, mi: string, se: string;
  let m = /^(\d{2})[ /-](\d{2})[ /-](\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) {
    [, d, mo, y, h, mi, se = '00'] = m as unknown as string[];
  } else {
    m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (!m) return null;
    [, y, mo, d, h, mi, se = '00'] = m as unknown as string[];
  }
  se = se ?? '00';
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}+05:30`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  // Reject roll-overs such as 31 02 2026 (Date.parse would accept some).
  const back = new Date(t + 330 * 60_000).toISOString();
  if (back.slice(0, 10) !== `${y}-${mo}-${d}` || back.slice(11, 19) !== `${h}:${mi}:${se}`) return null;
  return iso;
}

export function normaliseShiprocketPayload(body: unknown): ShipmentInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  // Validate the whole value: clipping first could turn a bad AWB into
  // someone else's valid one.
  const awb = typeof b.awb === 'string' || typeof b.awb === 'number' ? String(b.awb).trim() : '';
  if (!AWB_RE.test(awb)) return null;

  const label = (text(b.current_status, 100) ?? text(b.shipment_status, 100) ?? '').toUpperCase();
  const scansRaw = Array.isArray(b.scans) ? b.scans.slice(-MAX_SCANS) : [];
  const scans: ShipmentInput['scans'] = [];
  for (const raw of scansRaw) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    const at = parseShiprocketTime(s.date);
    const scanLabel = (text(s['sr-status-label'], 100) ?? text(s.status, 100) ?? '').toUpperCase();
    if (!at || !scanLabel) continue;
    scans.push({ at, label: scanLabel, activity: text(s.activity, 300), location: text(s.location, 200) });
  }

  return {
    awb,
    courier_name: text(b.courier_name, 100),
    status_label: label,
    status_at: parseShiprocketTime(b.current_timestamp) ?? scans.at(-1)?.at ?? null,
    etd: parseShiprocketTime(b.etd),
    is_return: b.is_return === 1 || b.is_return === '1' || b.is_return === true,
    order_ref: text(b.order_id, 100),
    scans,
  };
}
