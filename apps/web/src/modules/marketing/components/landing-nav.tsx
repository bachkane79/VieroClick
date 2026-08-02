"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { cn } from "@vieroc/ui";
import { Container, CtaPrimary } from "./landing-ui";

const LINKS = [
  { href: "#views", key: "features" },
  { href: "#agents", key: "agents" },
  { href: "#solutions", key: "solutions" },
  { href: "#pricing", key: "pricing" },
  { href: "#docs", key: "docs" },
] as const;

/**
 * Sticky marketing nav — translucent over the canvas, solid once scrolled.
 * Below `lg` the links move into a full-screen drawer; the drawer traps
 * nothing and closes on Escape, so it stays keyboard-reachable.
 */
export function LandingNav() {
  const t = useTranslations("landing.nav");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
        scrolled
          ? "border-border bg-surface/90 backdrop-blur"
          : "border-transparent bg-canvas/70 backdrop-blur"
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-full">
            <Image
              src="/logo_transparent.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Viero<span className="text-primary">Click</span>
            </span>
          </Link>

          <nav aria-label={t("features")} className="hidden items-center gap-7 lg:flex">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(l.key)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              {t("login")}
            </Link>
            <CtaPrimary href="/login" className="min-h-0 px-5 py-2.5 text-sm">
              {t("cta")}
            </CtaPrimary>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("openMenu")}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </Container>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-surface transition-transform duration-300 motion-reduce:transition-none lg:hidden",
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
        aria-hidden={!open}
      >
        <Container className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between">
            <span className="text-lg font-bold tracking-tight text-foreground">
              Viero<span className="text-primary">Click</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("closeMenu")}
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-4 flex flex-col">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                onClick={() => setOpen(false)}
                tabIndex={open ? undefined : -1}
                className="flex min-h-[56px] items-center border-b border-border text-xl font-bold text-foreground"
              >
                {t(l.key)}
              </Link>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pb-8">
            <Link
              href="/login"
              tabIndex={open ? undefined : -1}
              className="flex min-h-[48px] items-center justify-center rounded-full border border-border text-[15px] font-semibold text-foreground"
            >
              {t("login")}
            </Link>
            <CtaPrimary href="/login" className="w-full">
              {t("cta")}
            </CtaPrimary>
          </div>
        </Container>
      </div>
    </header>
  );
}
