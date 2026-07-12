"use client";

import { usePathname } from 'next/navigation';
import GlobalParallaxBackground from './GlobalParallaxBackground';

// The /admin section has its own full-screen sidebar layout, so it must NOT show
// the storefront header/footer/cart (they were overlapping the dashboard).
export default function SiteChrome({
  announcement,
  children,
  header,
  footer,
  cartDrawer
}: {
  announcement?: string | null;
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  cartDrawer: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }
  return (
    <>
      <GlobalParallaxBackground />
      {announcement ? (
        <div className="w-full bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] text-center text-xs md:text-sm py-2 px-4 tracking-wide">
          {announcement}
        </div>
      ) : null}
      {header}
      {children}
      {footer}
      {cartDrawer}
    </>
  );
}
