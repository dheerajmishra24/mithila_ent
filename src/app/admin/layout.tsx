"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, LayoutDashboard, ShoppingBag, PlusCircle, LogOut, ChevronLeft, ChevronRight, Settings, Users, FileText, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logout } from '@/actions/auth';

const navItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Categories', href: '/admin/categories', icon: Package },
  { name: 'Live Inventory', href: '/admin/inventory', icon: Package },
  { name: 'Promotions', href: '/admin/promotions', icon: PlusCircle },
  { name: 'Customers', href: '/admin/customers', icon: Users },
  { name: 'Content', href: '/admin/content', icon: FileText },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex h-screen bg-[var(--unbleached-cotton)] overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 256 }}
        className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] hidden md:flex flex-col border-r-2 border-[var(--turmeric)] relative z-20"
      >
        <div className="p-6 border-b-2 border-[var(--charcoal-ink)]/20 flex items-center justify-between overflow-hidden whitespace-nowrap h-[88px]">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--turmeric)]">MITHILA</h1>
                <p className="text-xs tracking-widest opacity-70 uppercase">Owner Portal</p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center w-full">
                <span className="font-serif text-2xl font-bold text-[var(--turmeric)]">M</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 bg-[var(--turmeric)] text-[var(--charcoal-ink)] rounded-full p-1 border-2 border-[var(--charcoal-ink)] shadow-[2px_2px_0_var(--charcoal-ink)] hover:translate-y-[1px] hover:shadow-[1px_1px_0_var(--charcoal-ink)] transition-all z-30"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-sm transition-colors whitespace-nowrap overflow-hidden ${isActive(item.href) ? 'bg-[var(--indigo-dye)] text-[var(--unbleached-cotton)]' : 'hover:bg-[var(--madder-red)]'}`}
            >
              <item.icon size={20} className="shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t-2 border-[var(--charcoal-ink)]/20">
          <form action={logout} className={isCollapsed ? '' : 'w-full'}>
            <button
              type="submit"
              title={isCollapsed ? 'Secure Logout' : undefined}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 w-full'} px-4 py-3 hover:bg-[var(--madder-red)] rounded-sm transition-colors text-left text-red-300 overflow-hidden whitespace-nowrap`}
            >
              <LogOut size={20} className="shrink-0" />
              {!isCollapsed && <span>Secure Logout</span>}
            </button>
          </form>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] p-4 flex justify-between items-center border-b-2 border-[var(--turmeric)]">
          <span className="font-serif font-bold text-[var(--turmeric)]">MITHILA</span>
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="w-10 h-10 flex items-center justify-center">
            <Menu />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-[var(--unbleached-cotton)] text-[var(--charcoal-ink)]">
          {children}
        </div>
      </main>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 left-0 bottom-0 w-72 max-w-[82%] bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] z-50 md:hidden flex flex-col border-r-2 border-[var(--turmeric)]"
            >
              <div className="p-6 border-b-2 border-[var(--charcoal-ink)]/20 flex items-center justify-between">
                <div className="flex flex-col">
                  <h1 className="font-serif text-2xl font-bold text-[var(--turmeric)]">MITHILA</h1>
                  <p className="text-xs tracking-widest opacity-70 uppercase">Owner Portal</p>
                </div>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="w-10 h-10 flex items-center justify-center hover:text-[var(--turmeric)]">
                  <X />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-colors ${isActive(item.href) ? 'bg-[var(--indigo-dye)] text-[var(--unbleached-cotton)]' : 'hover:bg-[var(--madder-red)]'}`}
                  >
                    <item.icon size={20} className="shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                ))}
              </nav>
              <div className="p-4 border-t-2 border-[var(--charcoal-ink)]/20">
                <form action={logout}>
                  <button type="submit" className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--madder-red)] rounded-sm transition-colors text-left text-red-300">
                    <LogOut size={20} className="shrink-0" />
                    <span>Secure Logout</span>
                  </button>
                </form>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
