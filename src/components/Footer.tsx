import Link from 'next/link';
import { getStoreSettings } from '@/lib/content';

export default async function Footer() {
  const settings = await getStoreSettings();
  return (
    <footer className="w-full bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)]/70 font-sans border-t-[6px] border-[var(--turmeric)] py-16">
      <div className="container mx-auto px-6 max-w-7xl">
        
        {/* Main Footer Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          
          {/* Identity Column */}
          <div className="space-y-4 col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-serif italic font-bold text-xl text-[var(--unbleached-cotton)] hover:text-[var(--turmeric)] transition-colors">
              <div className="w-6 h-6 rounded-full bg-[var(--madder-red)] flex items-center justify-center text-white font-bold font-serif text-xs">
                M
              </div>
              Mithila
            </Link>
            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
              Premium handloom fabrics and fine line artistry loomed with devotion and contemporary elegance.
            </p>
          </div>

          {/* Company links */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--unbleached-cotton)]">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-[var(--turmeric)] transition-colors">Our Legacy</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--turmeric)] transition-colors">Shop Fabrics</Link></li>
              <li><Link href="/wholesale" className="hover:text-[var(--turmeric)] transition-colors">Wholesale Accounts</Link></li>
              <li><Link href="/contact" className="hover:text-[var(--turmeric)] transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal links */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--unbleached-cotton)]">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/legal/terms-of-service" className="hover:text-[var(--turmeric)] transition-colors">Terms of Service</Link></li>
              <li><Link href="/legal/privacy-policy" className="hover:text-[var(--turmeric)] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/legal/shipping-returns" className="hover:text-[var(--turmeric)] transition-colors">Shipping & Returns</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--unbleached-cotton)]">Connect</h4>
            <div className="space-y-3 text-sm text-[var(--unbleached-cotton)]/70">
              <div>
                <p>{settings.support_email}</p>
                <p>{settings.support_phone}</p>
              </div>
              <div className="text-xs opacity-80 leading-relaxed">
                <p className="font-bold mb-1">GSTIN : 07AGUPM2548P1ZH</p>
                <p className="mb-2"><strong>Reg. Office:</strong> X-3458/7, Street -1, Raghubar Pura -2, Gandhi Nagar, DELHI - 110031</p>
                <p><strong>Warehouse:</strong> TA-106, Okhla Estate Marg, Tughlakabad Extension, Kalkaji New Delhi, Delhi 110019</p>
              </div>
            </div>
            <div className="flex gap-4 text-sm mt-3">
              <a href="#" className="hover:text-[var(--turmeric)]">Instagram</a>
              <a href="#" className="hover:text-[var(--turmeric)]">Pinterest</a>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="w-full h-[1px] bg-[var(--unbleached-cotton)]/20 mb-8"></div>

        {/* Bottom copyright block */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--unbleached-cotton)]/50 gap-4">
          <p>&copy; {new Date().getFullYear()} {settings.store_name}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/legal/privacy-policy" className="hover:underline">Privacy</Link>
            <Link href="/legal/terms-of-service" className="hover:underline">Terms</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
