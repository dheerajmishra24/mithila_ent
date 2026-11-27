import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/dal/session';

// Swatch kit settings are public (price and size shown on product pages).
export interface SwatchSettings {
  enabled: boolean;
  kitPrice: number;
  maxSwatches: number;
}

export const getSwatchSettings = cache(async (): Promise<SwatchSettings> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('swatch_settings')
    .select('enabled, kit_price, max_swatches')
    .eq('id', 1)
    .maybeSingle();
  return {
    enabled: Boolean(data?.enabled ?? false),
    kitPrice: Number(data?.kit_price ?? 99),
    maxSwatches: Number(data?.max_swatches ?? 5),
  };
});

export interface CreditEntry {
  id: string;
  entry: 'earn' | 'redeem' | 'restore' | 'revoke' | 'adjust';
  amount: number;
  balanceAfter: number;
  orderRef: string | null;
  note: string | null;
  createdAt: string;
}

export interface MySwatchCredit {
  balance: number;
  entries: CreditEntry[];
}

/** The signed-in customer's balance and recent ledger (RLS: own rows only). */
export async function getMySwatchCredit(limit = 50): Promise<MySwatchCredit | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const [acct, ledger] = await Promise.all([
    supabase.from('swatch_credit_accounts').select('balance').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('swatch_credit_ledger')
      .select('id, entry, amount, balance_after, order_id, note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  return {
    balance: Number(acct.data?.balance ?? 0),
    entries: (ledger.data ?? []).map((r) => ({
      id: r.id,
      entry: r.entry,
      amount: Number(r.amount),
      balanceAfter: Number(r.balance_after),
      orderRef: r.order_id ? String(r.order_id).split('-')[0].toUpperCase() : null,
      note: r.note,
      createdAt: r.created_at,
    })),
  };
}
