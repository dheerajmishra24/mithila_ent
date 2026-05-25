import { Button } from '@/components/ui/Button';

export default function AdminSettings() {
  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Store Settings</h1>
      
      <section className="bg-white border-2 border-[var(--charcoal-ink)] p-8 space-y-4">
        <h2 className="font-serif text-xl font-bold">General</h2>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Store Name</label>
          <input type="text" defaultValue="Mithila Enterprises" className="w-full border-2 border-[var(--charcoal-ink)] p-2 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Support Email</label>
          <input type="email" defaultValue="dheeraj.mishra02@gmail.com" className="w-full border-2 border-[var(--charcoal-ink)] p-2 focus:outline-none" />
        </div>
        <Button>Save Changes</Button>
      </section>

      <section className="bg-white border-2 border-[var(--charcoal-ink)] p-8 space-y-4">
        <h2 className="font-serif text-xl font-bold">API Keys & Integrations</h2>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Google Gemini API Key</label>
          <input type="password" value="**************" readOnly className="w-full border-2 border-[var(--charcoal-ink)] p-2 bg-[var(--unbleached-cotton)] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Stripe Secret Key</label>
          <input type="password" value="**************" readOnly className="w-full border-2 border-[var(--charcoal-ink)] p-2 bg-[var(--unbleached-cotton)] focus:outline-none" />
        </div>
      </section>
    </div>
  );
}
