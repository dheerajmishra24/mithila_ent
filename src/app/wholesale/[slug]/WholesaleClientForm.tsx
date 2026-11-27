"use client";

import React, { useState } from 'react';
import AdConsentCheckbox from '@/components/AdConsentCheckbox';
import { readAttribution } from '@/lib/leads/attribution-client';

interface WholesaleClientFormProps {
  categoryName: string;
  categorySlug: string;
  moq: string;
}

export default function WholesaleClientForm({
  categoryName,
  categorySlug,
  moq,
}: WholesaleClientFormProps) {
  const [formState, setFormState] = useState({
    businessName: '',
    taxId: '',
    email: '',
    phone: '',
    requirements: `Inquiring about bulk wholesale supply for ${categoryName}. Estimated volume: 50–100 meters.`,
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [adConsent, setAdConsent] = useState(false);
  // One id per enquiry, so a double click or retry is stored once.
  const [submissionId] = useState(() => crypto.randomUUID());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/wholesale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formState,
          category: categorySlug,
          adConsent,
          submissionId,
          attribution: readAttribution(),
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit wholesale inquiry.');
      }
    } catch {
      setError('An error occurred. Please try again or message our WhatsApp desk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 bg-white border-2 border-[var(--charcoal-ink)] shadow-[5px_5px_0_var(--charcoal-ink)] rounded-sm space-y-5">
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--madder-red)]">
          Direct Mill Inquiries
        </span>
        <h3 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">
          Request Wholesale Rate Card
        </h3>
        <p className="font-sans text-xs text-zinc-600">
          MOQ: {moq}. Our B2B team responds with current tier rate sheets within 4 working hours.
        </p>
      </div>

      {submitted ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-sm space-y-2">
          <h4 className="font-bold text-sm">Wholesale Inquiry Received!</h4>
          <p className="text-xs leading-relaxed">
            Thank you for reaching out. Our textile merchandising team has received your inquiry for{' '}
            <strong>{categoryName}</strong> and will email you the official rate card with roll availability.
          </p>
          <div className="pt-2">
            <a
              href={`https://wa.me/919818555220?text=${encodeURIComponent(
                `Hi, I just submitted an inquiry for ${categoryName} wholesale rate card.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-700 underline"
            >
              Need immediate assistance? Message us on WhatsApp &rarr;
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 font-sans">
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-zinc-800">
              Business / Label Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Atelier Delhi / Export Studio"
              value={formState.businessName}
              onChange={(e) => setFormState((s) => ({ ...s, businessName: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-[var(--charcoal-ink)]/30 rounded-sm focus:outline-hidden focus:border-[var(--madder-red)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-zinc-800">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                placeholder="Optional for sampling"
                value={formState.taxId}
                onChange={(e) => setFormState((s) => ({ ...s, taxId: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-[var(--charcoal-ink)]/30 rounded-sm focus:outline-hidden focus:border-[var(--madder-red)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-zinc-800">
                Contact Phone / WhatsApp *
              </label>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={formState.phone}
                onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-[var(--charcoal-ink)]/30 rounded-sm focus:outline-hidden focus:border-[var(--madder-red)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-zinc-800">
              Official Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="sourcing@yourbrand.com"
              value={formState.email}
              onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-[var(--charcoal-ink)]/30 rounded-sm focus:outline-hidden focus:border-[var(--madder-red)]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-zinc-800">
              Specific Requirements &amp; Estimated Volume *
            </label>
            <textarea
              rows={3}
              required
              value={formState.requirements}
              onChange={(e) => setFormState((s) => ({ ...s, requirements: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-[var(--charcoal-ink)]/30 rounded-sm focus:outline-hidden focus:border-[var(--madder-red)] resize-none"
            />
          </div>

          <AdConsentCheckbox id="wholesale-ad-consent" checked={adConsent} onChange={setAdConsent} />

          {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-[var(--madder-red)] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Sending Request...' : 'Submit Wholesale Inquiry'}
          </button>
        </form>
      )}
    </div>
  );
}
