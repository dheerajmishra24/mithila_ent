import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { setUserRole } from '@/actions/admin';

export const dynamic = 'force-dynamic';

const money = (n: any) => `₹${Number(n || 0).toFixed(2)}`;

export default async function AdminCustomers() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, created_at')
    .order('created_at', { ascending: false });

  const { data: orders } = await supabase.from('orders').select('user_id, total_amount, is_paid');

  const stats: Record<string, { count: number; spend: number }> = {};
  for (const o of orders || []) {
    if (!o.user_id) continue;
    const s = stats[o.user_id] || { count: 0, spend: 0 };
    s.count += 1;
    if (o.is_paid) s.spend += Number(o.total_amount || 0);
    stats[o.user_id] = s;
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Clientele</h1>
        <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Registered customers &amp; roles</p>
      </div>

      <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b-2 border-[var(--charcoal-ink)] text-xs uppercase tracking-widest">
              <th className="pb-3 font-bold">Customer</th>
              <th className="pb-3 font-bold">Role</th>
              <th className="pb-3 font-bold text-center">Orders</th>
              <th className="pb-3 font-bold text-right">Total Spent</th>
              <th className="pb-3 font-bold">Joined</th>
              <th className="pb-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {(profiles || []).map((p) => {
              const st = stats[p.id] || { count: 0, spend: 0 };
              const isAdmin = p.role === 'admin';
              return (
                <tr key={p.id} className="border-b border-[var(--charcoal-ink)]/10 hover:bg-[var(--unbleached-cotton)] transition-colors">
                  <td className="py-4">
                    <div className="font-bold">{p.full_name || 'Unnamed'}</div>
                    <div className="text-xs opacity-50 font-mono">{p.id.split('-')[0]}</div>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-2 ${isAdmin ? 'border-[var(--turmeric)] text-[var(--charcoal-ink)] bg-[var(--turmeric)]/20' : 'border-[var(--charcoal-ink)]/20'}`}>
                      {p.role}
                    </span>
                  </td>
                  <td className="py-4 text-center">{st.count}</td>
                  <td className="py-4 text-right font-bold text-[var(--madder-red)]">{money(st.spend)}</td>
                  <td className="py-4 text-sm opacity-70">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="py-4 text-right">
                    <form
                      action={async () => {
                        'use server';
                        await setUserRole(p.id, isAdmin ? 'retail' : 'admin');
                      }}
                    >
                      <button
                        type="submit"
                        className="text-[10px] font-bold uppercase tracking-widest border-2 border-[var(--charcoal-ink)] px-3 py-1.5 hover:bg-[var(--charcoal-ink)] hover:text-white transition-colors"
                      >
                        {isAdmin ? 'Revoke Admin' : 'Make Admin'}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(!profiles || profiles.length === 0) && (
              <tr>
                <td colSpan={6} className="py-8 text-center opacity-50">No customers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
