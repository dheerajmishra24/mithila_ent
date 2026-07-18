import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPosts } from '@/lib/blog-data';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import type { Metadata } from 'next';

/* ── Static Params ── */
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

/* ── Dynamic Metadata ── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title} | Mithila Enterprises Blog`,
    description: post.excerpt,
  };
}

/* ── Page Component ── */
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const relatedPosts = allPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  const paragraphs = post.content.split('\n\n');

  return (
    <main className="flex-grow w-full bg-transparent text-[var(--charcoal-ink)] pt-24 md:pt-28 pb-24 font-sans overflow-x-hidden relative">
      {/* ── Hero Cover Image ── */}
      <section className="relative w-full max-w-7xl mx-auto px-6">
        <div className="relative w-full aspect-[21/9] overflow-hidden rounded-sm border-2 border-[var(--charcoal-ink)] shadow-[6px_6px_0_var(--charcoal-ink)]">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          {/* Gradient overlay for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--charcoal-ink)]/60 via-transparent to-transparent" />
        </div>
      </section>

      {/* ── Article Header ── */}
      <section className="relative w-full max-w-4xl mx-auto px-6 mt-10 md:mt-14">
        <BackgroundPattern className="opacity-20" />

        <div className="relative z-10 space-y-5">
          {/* Category · Date · Author */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-sans">
            <span className="inline-block px-3 py-1 bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] font-bold uppercase tracking-widest rounded-sm">
              {post.category}
            </span>
            <span className="text-zinc-400 font-semibold uppercase tracking-wider">
              {post.date}
            </span>
            <span className="text-zinc-400">·</span>
            <span className="text-zinc-700 font-medium">{post.author}</span>
          </div>

          {/* Title */}
          <h1 className="font-serif italic text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.15] text-[var(--charcoal-ink)]">
            {post.title}
          </h1>

          {/* Decorative divider */}
          <div className="flex items-center gap-3 pt-2">
            <span className="block w-16 h-px bg-[var(--madder-red)]" />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--madder-red)]"
            >
              <path d="M12 2L2 12l10 10 10-10L12 2z" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span className="block w-16 h-px bg-[var(--madder-red)]" />
          </div>
        </div>
      </section>

      {/* ── Article Body ── */}
      <article className="relative w-full max-w-4xl mx-auto px-6 mt-10 md:mt-14">
        <div className="space-y-6">
          {paragraphs.map((paragraph, idx) => (
            <p
              key={idx}
              className="font-sans text-sm md:text-base text-zinc-700 leading-[1.85] text-justify"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </article>

      {/* ── Back Link ── */}
      <section className="w-full max-w-4xl mx-auto px-6 mt-16 md:mt-20">
        <div className="border-t-2 border-[var(--charcoal-ink)]/10 pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-xs font-bold text-[var(--madder-red)] uppercase tracking-widest hover:text-[var(--charcoal-ink)] transition-colors"
          >
            <span aria-hidden="true">&larr;</span>
            Back to All Articles
          </Link>
        </div>
      </section>

      {/* ── Related Articles ── */}
      {relatedPosts.length > 0 && (
        <section className="w-full max-w-7xl mx-auto px-6 mt-16 md:mt-24">
          <div className="text-center mb-12 space-y-3">
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-widest font-semibold">
              Keep Reading
            </span>
            <h2 className="font-serif italic text-2xl md:text-3xl font-bold text-[var(--charcoal-ink)]">
              Related Articles
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {relatedPosts.map((related) => (
              <Link
                key={related.slug}
                href={`/blog/${related.slug}`}
                className="group block"
              >
                <article className="flex flex-col h-full border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)] bg-[var(--unbleached-cotton)] hover:shadow-[6px_6px_0_var(--madder-red)] hover:border-[var(--madder-red)] transition-all duration-300 rounded-sm overflow-hidden">
                  {/* Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                    <Image
                      src={related.coverImage}
                      alt={related.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute top-3 left-3 inline-block px-3 py-1 bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] text-[10px] font-bold uppercase tracking-widest rounded-sm">
                      {related.category}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col flex-grow p-6 space-y-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                      {related.date}
                    </span>
                    <h3 className="font-serif italic font-bold text-lg leading-snug text-[var(--charcoal-ink)] group-hover:text-[var(--madder-red)] transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="font-sans text-xs text-zinc-700 leading-relaxed line-clamp-3 flex-grow">
                      {related.excerpt}
                    </p>
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
      )}
    </main>
  );
}
