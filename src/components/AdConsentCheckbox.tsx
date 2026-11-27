'use client';

// Separate, optional, unticked consent (DPDP: purpose-specific, not bundled
// with the enquiry itself). Ticking it lets us tell Google/Meta whether this
// enquiry became an order, to see which ads work. The enquiry is sent either way.
export default function AdConsentCheckbox({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--madder-red)]"
      />
      <label htmlFor={id} className="font-sans text-[11px] leading-snug text-zinc-800">
        Optional: let Mithila tell Google and Meta if this enquiry becomes an order, so we can see which of our ads work.
        Not needed to contact us. You can withdraw this at any time by writing to us.
      </label>
    </div>
  );
}
