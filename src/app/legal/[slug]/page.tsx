import React from 'react';
import { notFound } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const revalidate = 86400; // Cache for 24 hours

export async function generateStaticParams() {
  return [
    { slug: 'privacy-policy' },
    { slug: 'terms-of-service' },
    { slug: 'shipping-returns' }
  ];
}

interface LegalDoc {
  title: string;
  date: string;
  sections: { title: string; paragraphs: string[] }[];
}

const legalDocuments: Record<string, LegalDoc> = {
  'privacy-policy': {
    title: "Privacy Policy",
    date: "09 Jan 2026",
    sections: [
      {
        title: "1. Information We Collect",
        paragraphs: [
          "At Mithila Enterprises, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data when you interact with our website, services, and physical fabric creations. By using our platform, you consent to the practices described in this policy.",
          "We may collect the following types of information:",
          "Name, email address, phone number, and other contact details provided during customer account creation, newsletter registration, or fabric order placement.",
          "Billing details, shipping addresses, and transaction tokens for processing secure payments.",
          "IP address, browser type, operating system, and hardware details to optimize page load speeds.",
          "Feedback or artisan inquiry responses submitted through our forms."
        ]
      },
      {
        title: "2. How We Use Your Information",
        paragraphs: [
          "We use your information strictly to provide, personalize, and improve our services:",
          "To process fabric transactions, package shipments, and manage your account portal.",
          "To send shipping updates, dispatch invoices, and notify you of new seasonal handloom swatches.",
          "To analyze browsing behavior to ensure optimal performance on lower-speed mobile connections."
        ]
      },
      {
        title: "3. How We Share Your Information",
        paragraphs: [
          "We respect your privacy and only share your information under the following limited conditions:",
          "With trusted logistics providers (e.g. Delhivery, India Post) to fulfill delivery handoffs.",
          "With secure, PCI-compliant payment gateways to handle payment authorization.",
          "To comply with legal frameworks or requests from regional authorities.",
          "We never sell, rent, or lease your personal information to third-party advertisers."
        ]
      },
      {
        title: "4. Data Security",
        paragraphs: [
          "We implement rigorous safeguards to protect your personal details, including secure socket layer encryption (HTTPS), firewalled databases, and restricted employee access panels. While we strive to maintain absolute security, no data storage system can be guaranteed 100% impenetrable."
        ]
      }
    ]
  },
  'terms-of-service': {
    title: "Terms of Service",
    date: "14 Jan 2026",
    sections: [
      {
        title: "1. Acceptance of Terms",
        paragraphs: [
          "Welcome to Mithila Enterprises. By accessing or purchasing from our digital storefront and weaving services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please refrain from using our platform.",
          "By utilizing our shopping tools, you confirm that you are at least 18 years of age or possess formal parental or guardian consent to conduct payment actions."
        ]
      },
      {
        title: "2. Services & Custom Weaving",
        paragraphs: [
          "Mithila Enterprises provides custom loomed textiles, standard fabrics (Cotton, Linen, Silk Blends), and bespoke embroidered custom garments.",
          "Since all fabrics are hand-painted and loomed manually, minor variations in color pigment saturation, thread slubs, and geometric weaving alignments are natural characteristics of handloom art and are not considered manufacturing defects."
        ]
      },
      {
        title: "3. User Responsibilities",
        paragraphs: [
          "You agree to use our services exclusively for lawful purchasing and customization purposes.",
          "Any automated scraping of our proprietary vector artworks, weaver profiles, or database catalogs is strictly prohibited.",
          "Providing falsified details during user signup or checkout is grounds for immediate account suspension."
        ]
      },
      {
        title: "4. Limitation of Liability",
        paragraphs: [
          "Mithila Enterprises is provided 'as is' without warranties of any kind. We are not liable for incidental damage resulting from improper cleaning (e.g. machine washing dry-clean only silk weaves)."
        ]
      }
    ]
  },
  'shipping-returns': {
    title: "Shipping & Returns Policy",
    date: "23 May 2026",
    sections: [
      {
        title: "1. Shipping Protocol",
        paragraphs: [
          "All domestic orders are processed and dispatched within 48 hours of payment verification. Standard transit times range from 3 to 5 business days. Heavyweight orders exceeding 50 yards are shipped via freight and require a scheduled delivery window. Tracking information is provided immediately upon dispatch."
        ]
      },
      {
        title: "2. Return Policy",
        paragraphs: [
          "We accept returns within 14 days of delivery. The fabric must remain uncut, unwashed, and entirely free of ambient odors or physical alterations. Once the returned yardage passes our structural inspection, a full refund is issued to the original payment method. Custom dye runs and wholesale bulk orders are final sale and cannot be returned."
        ]
      }
    ]
  }
};

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let doc = legalDocuments[slug];

  // CMS override (Admin > Content). A non-empty body replaces the built-in copy.
  try {
    const sb = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: cms } = await sb
      .from('site_content')
      .select('title, body')
      .eq('key', `legal_${slug}`)
      .single();
    if (cms?.body && cms.body.trim()) {
      doc = {
        title: cms.title || doc?.title || 'Policy',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        sections: [
          { title: '', paragraphs: cms.body.split(/\n\s*\n/).map((x: string) => x.trim()).filter(Boolean) },
        ],
      };
    }
  } catch {
    // ignore CMS read failures; fall back to built-in copy
  }

  if (!doc) {
    notFound();
  }

  return (
    <main className="flex-grow w-full bg-transparent text-zinc-900 pt-32 pb-24 font-sans">
      <div className="container mx-auto px-6 max-w-3xl bg-white p-8 md:p-16 border border-zinc-150 shadow-md rounded-2xl mt-8">
        
        {/* Document Header */}
        <div className="border-b border-zinc-100 pb-6 mb-10">
          <span className="text-xs uppercase font-bold tracking-wider text-purple-600">Legal Policy</span>
          <h1 className="font-serif italic text-4xl md:text-5xl font-bold mt-2">{doc.title}</h1>
          <p className="font-sans text-[10px] text-zinc-400 mt-3 font-semibold uppercase tracking-wider">Effective Date: {doc.date}</p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {doc.sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h2 className="font-serif italic font-bold text-xl md:text-2xl text-zinc-950">
                {section.title}
              </h2>
              {section.paragraphs.map((p, pIdx) => (
                <p key={pIdx} className="font-sans text-sm md:text-base leading-relaxed text-zinc-700 text-justify">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>

        {/* Document Footer */}
        <div className="border-t border-zinc-100 pt-8 mt-12 text-center">
          <p className="font-sans text-xs text-zinc-400">
            For further clarifications regarding our policies, please write to mithlaenterprises11@gmail.com.
          </p>
        </div>

      </div>
    </main>
  );
}
