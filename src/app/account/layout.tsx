import Link from 'next/link';
import { logout } from '@/actions/auth';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-grow bg-transparent py-16">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl">
        <h1 className="font-serif text-4xl font-bold text-[var(--charcoal-ink)] mb-8">My Portal</h1>
        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="flex flex-col space-y-2 border-l-2 border-[var(--charcoal-ink)]/20 pl-4">
              <Link href="/account/orders" className="font-sans font-bold tracking-widest uppercase hover:text-[var(--madder-red)] transition-colors py-2">Orders</Link>
              <Link href="/account/profile" className="font-sans font-bold tracking-widest uppercase hover:text-[var(--madder-red)] transition-colors py-2">Profile Details</Link>
              <Link href="/account/addresses" className="font-sans font-bold tracking-widest uppercase hover:text-[var(--madder-red)] transition-colors py-2">Saved Addresses</Link>
              <form action={logout} className="mt-8">
                <button type="submit" className="text-left font-sans font-bold tracking-widest uppercase text-red-600 hover:text-red-800 transition-colors py-2 w-full">Logout</button>
              </form>
            </nav>
          </aside>
          
          {/* Content */}
          <div className="flex-grow">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
