import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import StructuredData from "@/components/StructuredData";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} h-full antialiased`}
    >
      <head>
        <StructuredData />
      </head>
      <body className="min-h-full flex flex-col font-sans relative overflow-x-hidden w-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <Header />
        {children}
        <Footer />
        <CartDrawer />
      </body>
    </html>
  );
}
