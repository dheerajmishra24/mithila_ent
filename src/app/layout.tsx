import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import StructuredData from "@/components/StructuredData";
import { getSiteContentMap } from "@/lib/content";

const playfair = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mithila Enterprises | Premium Cotton & Linen",
  description: "Wholesale B2C Premium Cotton & Linen Fabrics inspired by Madhubani Art.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = await getSiteContentMap();
  const announcement = content["announcement"]?.body?.trim();
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} h-full antialiased`}
    >
      <head>
        <StructuredData />
      </head>
      <body className="min-h-full flex flex-col font-sans relative overflow-x-hidden w-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {announcement ? (
          <div className="w-full bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] text-center text-xs md:text-sm py-2 px-4 tracking-wide">
            {announcement}
          </div>
        ) : null}
        <Header />
        {children}
        <Footer />
        <CartDrawer />
      </body>
    </html>
  );
}
