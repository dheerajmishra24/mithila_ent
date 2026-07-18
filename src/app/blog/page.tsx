import Image from 'next/image';
import Link from 'next/link';
import { getAllPosts } from '@/lib/blog-data';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "The Weaver's Journal | Mithila Enterprises Blog",
  description:
    'Insights on Indian textile heritage, handloom innovation, organic dyeing, and sustainable fabric sourcing from Mithila Enterprises.',
};

export default function BlogListingPage() {
  const posts = getAllPosts();

  return (
    <main className="flex-grow w-full bg-transparent text-[var(--charcoal-ink)] pt-24 md:pt-28 pb-24 font-sans overflow-x-hidden relative">
      {/* ── Hero Header ── */}
      <section className="relative w-full max-w-7xl mx-auto px-6 pt-8 pb-16 md:pt-12 md:pb-24 text-center">
        <BackgroundPattern className="opacity-40" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-5">
          <span className="inline-block text-[var(--madder-red)] font-sans text-xs uppercase tracking-widest font-semibold">
            Stories &amp; Insights
          </span>

          <h1 className="font-serif italic text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] text-[var(--charcoal-ink)]">
            The Weaver&rsquo;s Journal
          </h1>

          <p className="font-sans text-sm md:text-base text-zinc-700 leading-relaxed max-w-xl mx-auto">
            Dispatches from the loom floor — exploring heritage dyeing
            techniques, handloom innovation, sustainable sourcing, and the
            living culture of Indian textiles.
          </p>

          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <span className="block w-12 h-px bg-[var(--charcoal-ink)]/30" />
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--madder-red)]"
            >
              <path d="M12 2L2 12l10 10 10-10L12 2z" />
              <path d="M12 6L6 12l6 6 6-6L12 6z" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span className="block w-12 h-px bg-[var(--charcoal-ink)]/30" />
          </div>
        </div>
      </section>

      {/* ── Blog Grid ── */}
      <section className="w-full max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block"
            >
              <article className="flex flex-col h-full border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)] bg-[var(--unbleached-cotton)] hover:shadow-[6px_6px_0_var(--madder-red)] hover:border-[var(--madder-red)] transition-all duration-300 rounded-sm overflow-hidden">
                {/* Cover Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  {/* Category badge */}
                  <span className="absolute top-3 left-3 inline-block px-3 py-1 bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] text-[10px] font-bold uppercase tracking-widest rounded-sm">
                    {post.category}
                  </span>
                </div>

                {/* Card Body */}
                <div className="flex flex-col flex-grow p-6 space-y-3">
                  {/* Date */}
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    {post.date}
                  </span>

                  {/* Title */}
                  <h2 className="font-serif italic font-bold text-lg leading-snug text-[var(--charcoal-ink)] group-hover:text-[var(--madder-red)] transition-colors line-clamp-2">
                    {post.title}
                  </h2>

                  {/* Excerpt */}
                  <p className="font-sans text-xs text-zinc-700 leading-relaxed line-clamp-3 flex-grow">
                    {post.excerpt}
                  </p>

                  {/* Read link */}
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--madder-red)] uppercase tracking-wider pt-3 border-t border-[var(--charcoal-ink)]/10 group-hover:gap-2 transition-all">
                    Read Article
                    <span aria-hidden="true">&rarr;</span>
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
