// Pulls message statuses out of a WhatsApp Cloud API webhook body. Ignores
// everything else (incoming messages, other fields) and caps the batch.

const STATUSES = new Set(['sent', 'delivered', 'read', 'failed']);

type StatusEntry = { id?: unknown; status?: unknown };
type Payload = { entry?: { changes?: { field?: unknown; value?: { statuses?: StatusEntry[] } }[] }[] };

export function extractStatuses(body: unknown): { id: string; status: string }[] {
  const out: { id: string; status: string }[] = [];
  for (const entry of (body as Payload)?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'messages') continue;
      for (const s of change.value?.statuses ?? []) {
        if (typeof s?.id === 'string' && s.id.length <= 200 && typeof s.status === 'string' && STATUSES.has(s.status)) {
          out.push({ id: s.id, status: s.status });
        }
        if (out.length >= 100) return out;
      }
    }
  }
  return out;
}
