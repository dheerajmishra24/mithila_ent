"use client";

import { useRouter, useSearchParams } from 'next/navigation';

export default function SortDropdown({ currentSort }: { currentSort: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    
    if (newSort === 'featured') {
      params.delete('sort');
    } else {
      params.set('sort', newSort);
    }
    
    router.push(`/shop?${params.toString()}`);
  };

  return (
    <div className="relative">
      <select 
        className="appearance-none bg-white border border-[var(--charcoal-ink)]/20 text-[var(--charcoal-ink)] font-sans text-sm font-bold rounded-md pl-4 pr-10 py-2 focus:outline-none focus:border-[var(--charcoal-ink)]/40 cursor-pointer shadow-sm"
        value={currentSort || 'featured'}
        onChange={handleSortChange}
      >
        <option value="featured">Featured First</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--charcoal-ink)]/50">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
      </div>
    </div>
  );
}
