"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@vieroc/ui";

/**
 * Shared primitives for the marketing landing page.
 *
 * The landing surface deliberately does NOT reuse the product `Button` — its
 * size scale (h-8/h-10) is tuned for app chrome and reads undersized next to a
 * 56px display heading. Marketing CTAs live here instead, so changing the app
 * button never silently reshapes the landing page.
 */

/** Small ALL-CAPS orange label that opens most sections. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-bold uppercase tracking-[0.08em] text-primary", className)}>
      {children}
    </p>
  );
}

/** Display heading. `as` keeps the document outline correct per section. */
export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "text-3xl font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionLead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-lg font-normal leading-relaxed text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/**
 * Large display heading whose text fades from ink to grey along its length.
 *
 * The fade is the reference's signature move: it lets a long headline stay
 * enormous without the tail competing with the copy underneath. `background-
 * clip: text` needs `text-transparent`, which would erase the heading entirely
 * where it is unsupported — so the gradient is gated behind `supports-[]` and
 * plain `text-foreground` is what actually ships if the query fails.
 */
export function DisplayTitle({
  children,
  className,
  as: Tag = "h2",
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "text-balance font-bold leading-[1.1] tracking-[-0.03em] text-foreground",
        "text-[30px] sm:text-[38px] lg:text-[48px]",
        "supports-[background-clip:text]:bg-gradient-to-r supports-[background-clip:text]:from-foreground supports-[background-clip:text]:via-foreground supports-[background-clip:text]:to-[#A0A6B4] supports-[background-clip:text]:bg-clip-text supports-[background-clip:text]:text-transparent",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** 12px ALL-CAPS wide-tracked grey label. Used above tag clouds and stat rails. */
export function MicroLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Page-width container. 1240px + the redesign's gutter rhythm. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1240px] px-4 md:px-6", className)}>{children}</div>
  );
}

const ctaBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-all duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Orange fill. One per view — never two side by side. */
export function CtaPrimary({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        ctaBase,
        "bg-primary text-primary-foreground shadow-soft hover:-translate-y-0.5 hover:bg-primary-hover",
        className
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Near-black fill. The high-contrast primary used where orange would sit on an
 * orange-tinted surface, or where the section already spends its orange on an
 * accent — the hero, the stats header, the solutions panel.
 */
export function CtaDark({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        ctaBase,
        "bg-[#14171F] text-white shadow-soft hover:-translate-y-0.5 hover:bg-[#242833]",
        className
      )}
    >
      {children}
    </Link>
  );
}

/** White fill + hairline. The partner to CtaPrimary in a hero pair. */
export function CtaGhost({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        ctaBase,
        "border border-border bg-surface text-foreground hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-subtle",
        className
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Scroll-reveal wrapper.
 *
 * Renders visible by default, so the content survives with JS disabled, with
 * `prefers-reduced-motion`, and during SSR. Only elements that are genuinely
 * below the fold when the effect runs get hidden and then faded in — anything
 * already on screen is left alone rather than flashing.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    setHidden(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHidden(false);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: hidden ? undefined : `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-500 ease-out",
        hidden ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100",
        className
      )}
    >
      {children}
    </div>
  );
}
