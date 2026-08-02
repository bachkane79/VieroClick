"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@vieroc/ui";
import { Container, CtaGhost, CtaPrimary, DisplayTitle, Reveal, SectionLead } from "./landing-ui";

/**
 * Three-tier pricing with a monthly/yearly toggle.
 *
 * Cards are equal height with the CTA pinned to the bottom (`mt-auto`), so the
 * three buttons line up regardless of how long the feature copy runs in either
 * locale — Vietnamese feature strings are noticeably longer than the English.
 */
export function LandingPricing() {
  const t = useTranslations("landing.pricing");
  const [yearly, setYearly] = useState(false);
  const toggleId = useId();

  const plans = [
    {
      key: "starter",
      name: t("starterName"),
      tagline: t("starterTagline"),
      price: t("starterPrice"),
      note: t("starterNote"),
      cta: t("starterCta"),
      features: [t("starterF1"), t("starterF2"), t("starterF3"), t("starterF4"), t("starterF5")],
      featured: false,
    },
    {
      key: "pro",
      name: t("proName"),
      tagline: t("proTagline"),
      price: yearly ? t("proPriceYearly") : t("proPriceMonthly"),
      note: t("perUserMonth"),
      cta: t("proCta"),
      features: [t("proF1"), t("proF2"), t("proF3"), t("proF4"), t("proF5")],
      featured: true,
    },
    {
      key: "enterprise",
      name: t("enterpriseName"),
      tagline: t("enterpriseTagline"),
      price: t("enterprisePrice"),
      note: "",
      cta: t("enterpriseCta"),
      features: [
        t("enterpriseF1"),
        t("enterpriseF2"),
        t("enterpriseF3"),
        t("enterpriseF4"),
        t("enterpriseF5"),
      ],
      featured: false,
    },
  ];

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="bg-canvas py-16 md:py-20">
      <Container>
        <Reveal className="text-center">
          <DisplayTitle id="pricing-title" className="mx-auto max-w-[760px]">
            {t("title")}
          </DisplayTitle>
          <SectionLead className="mx-auto mt-5 max-w-[52ch] text-base">{t("lead")}</SectionLead>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span
              id={`${toggleId}-monthly`}
              className={cn(
                "text-sm font-medium",
                yearly ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {t("monthly")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={yearly}
              aria-label={t("toggleLabel")}
              onClick={() => setYearly((v) => !v)}
              // The switch reads best at 28px but must still be a 44px touch
              // target, so the hit area is expanded with a transparent
              // pseudo-element rather than by growing the control.
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full border border-border transition-colors duration-150 before:absolute before:-inset-2 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                yearly ? "bg-primary" : "bg-surface-hover"
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-surface shadow-soft transition-transform duration-150 motion-reduce:transition-none",
                  yearly ? "translate-x-[24px]" : "translate-x-[2px]"
                )}
              />
            </button>
            <span
              className={cn(
                "text-sm font-medium",
                yearly ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {t("yearly")}
            </span>
            <span className="rounded-full bg-mint-soft px-2.5 py-1 text-2xs font-bold text-mint">
              {t("save")}
            </span>
          </div>
        </Reveal>

        <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.key} delay={i * 100} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-shell border bg-[hsl(var(--landing-card))] p-7",
                  p.featured ? "border-2 border-primary shadow-elevated lg:-my-2" : "border-border"
                )}
              >
                {p.featured ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-2xs font-bold tracking-wide text-primary-foreground">
                    {t("popular")}
                  </span>
                ) : null}

                <h3 className="text-lg font-bold tracking-tight text-foreground">{p.name}</h3>
                <p className="mt-1.5 text-sm font-normal text-muted-foreground">{p.tagline}</p>

                <p className="mt-6 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "text-4xl font-bold tracking-tight",
                      p.featured ? "text-primary" : "text-foreground"
                    )}
                  >
                    {p.price}
                  </span>
                  {p.note ? <span className="text-xs text-muted-foreground">{p.note}</span> : null}
                </p>

                <ul className="mt-7 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          p.featured ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-sm font-normal text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  {p.featured ? (
                    <CtaPrimary href="/register" className="w-full">
                      {p.cta}
                    </CtaPrimary>
                  ) : (
                    <CtaGhost href="/register" className="w-full">
                      {p.cta}
                    </CtaGhost>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
