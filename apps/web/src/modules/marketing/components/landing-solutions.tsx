"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Bot, Check, Sparkles } from "lucide-react";
import { cn } from "@vieroc/ui";
import { Container, CtaDark, DisplayTitle, Reveal, SectionLead } from "./landing-ui";

/* -------------------------------------------------------------- solutions */

const TEAM_TABS = ["projects", "marketing", "product", "ops", "hr", "leadership"] as const;

/**
 * Per-team solutions. The tab strip genuinely swaps the panel rather than
 * decorating it, so it carries real tab semantics.
 */
export function LandingSolutions() {
  const t = useTranslations("landing.solutions");
  const [active, setActive] = useState<(typeof TEAM_TABS)[number]>("projects");

  return (
    <section aria-labelledby="solutions-title" id="solutions" className="bg-canvas py-20 md:py-28">
      <Container>
        <Reveal className="mx-auto max-w-[720px] text-center">
          <DisplayTitle id="solutions-title">{t("title")}</DisplayTitle>
        </Reveal>
        <Reveal delay={100}>
          <SectionLead className="mx-auto mt-5 max-w-[58ch] text-center text-base">
            {t("lead")}
          </SectionLead>
        </Reveal>

        <Reveal delay={150}>
          <div
            role="tablist"
            aria-label={t("tablistLabel")}
            className="no-scrollbar mt-9 flex flex-nowrap items-center justify-start gap-2.5 overflow-x-auto px-1 md:flex-wrap md:justify-center md:overflow-visible"
          >
            {TEAM_TABS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active === k}
                aria-controls="solutions-panel"
                onClick={() => setActive(k)}
                className={cn(
                  "min-h-[44px] shrink-0 rounded-full border px-5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                  active === k
                    ? "border-primary bg-surface text-primary"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-foreground"
                )}
              >
                {t(`${k}Tab`)}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div
            id="solutions-panel"
            role="tabpanel"
            className="mt-10 grid gap-10 rounded-shell border border-border bg-[hsl(var(--landing-card))] p-7 md:p-12 lg:grid-cols-[48fr_52fr] lg:gap-14"
          >
            <div>
              <h3 className="text-balance text-[26px] font-bold leading-[1.12] tracking-[-0.02em] text-foreground md:text-[34px]">
                {t(`${active}HeadA`)}
                <br />
                {t(`${active}HeadB`)}
                <br />
                <span className="text-text-disabled">{t(`${active}HeadC`)}</span>
              </h3>

              <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
                {t(`${active}Body`)}
              </p>

              <ul className="mt-7 space-y-2.5">
                {(["Point1", "Point2", "Point3"] as const).map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                    <span className="text-sm text-foreground">{t(`${active}${p}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <ul className="space-y-3">
                {(["Agent1", "Agent2", "Agent3", "Agent4"] as const).map((a, i) => (
                  <li
                    key={a}
                    className="flex items-center gap-3.5 rounded-card border border-border bg-surface px-4 py-3.5 shadow-soft"
                  >
                    <span className="relative shrink-0">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full",
                          [
                            "bg-peach-soft text-peach",
                            "bg-mint-soft text-mint",
                            "bg-sky-soft text-sky",
                            "bg-brand-soft text-primary",
                          ][i]
                        )}
                      >
                        <Bot className="h-4 w-4" />
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-lavender text-white ring-2 ring-surface">
                        <Sparkles className="h-2 w-2" />
                      </span>
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {t(`${active}${a}`)}
                    </span>
                  </li>
                ))}
              </ul>

              <CtaDark href="#pricing" className="mt-6">
                {t("cta")}
                <ArrowRight className="h-4 w-4" />
              </CtaDark>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
