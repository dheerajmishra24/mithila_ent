"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, LayoutDashboard, ShoppingBag, PlusCircle, LogOut, ChevronLeft, ChevronRight, Settings, Users, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logout } from '@/actions/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

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

  return (
    <div className="flex h-screen bg-[var(--unbleached-cotton)] overflow-hidden font-sans">
      {/* Sidebar */}
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

        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-[var(--turmeric)] text-[var(--charcoal-ink)] rounded-full p-1 border-2 border-[var(--charcoal-ink)] shadow-[2px_2px_0_var(--charcoal-ink)] hover:translate-y-[1px] hover:shadow-[1px_1px_0_var(--charcoal-ink)] transition-all z-30"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link 
                key={item.href}
                href={item.href} 
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-sm transition-colors whitespace-nowrap overflow-hidden
                  ${isActive ? 'bg-[var(--indigo-dye)] text-[var(--unbleached-cotton)]' : 'hover:bg-[var(--madder-red)]'}
                `}
              >
                <item.icon size={20} className="shrink-0" /> 
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t-2 border-[var(--charcoal-ink)]/20">
          <form action={logout} className={isCollapsed ? '' : 'w-full'}>
            <button
              type="submit"
              title={isCollapsed ? "Secure Logout" : undefined}
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
          <button><LayoutDashboard /></button>
        </header>

        <div className="flex-1 overflow-y-auto bg-[var(--unbleached-cotton)] text-[var(--charcoal-ink)]">
          {children}
        </div>
      </main>
    </div>
  );
}
