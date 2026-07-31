import { useTranslations } from "next-intl";
import { Award, FileClock, Lock, MapPin, ShieldCheck, Star } from "lucide-react";
import { cn } from "@vieroc/ui";
import {
  Container,
  CtaDark,
  CtaGhost,
  DisplayTitle,
  Reveal,
  SectionLead,
} from "./landing-ui";
import { CtaAppMock } from "./mocks/cta-app-mock";

/* ------------------------------------------------------------------ stats */

const STATS = ["stat1", "stat2", "stat3", "stat4"] as const;

/**
 * The results strip. Hairline-divided columns rather than cards, with every
 * description bottom-aligned so the four numbers read as one row and the four
 * paragraphs as another — the reference's whole trick.
 */
export function LandingStats() {
  const t = useTranslations("landing.stats");

  return (
    <section aria-labelledby="stats-title" className="bg-canvas py-20 md:py-28">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <Reveal className="max-w-[880px]">
            <DisplayTitle id="stats-title">{t("title")}</DisplayTitle>
            <SectionLead className="mt-5 max-w-[62ch] text-base">{t("lead")}</SectionLead>
          </Reveal>
          <Reveal delay={100} className="shrink-0">
            <CtaDark href="/login">{t("cta")}</CtaDark>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-10 border-t border-border pt-9 sm:grid-cols-2 sm:gap-0 lg:grid-cols-4">
          {STATS.map((k, i) => (
            <Reveal key={k} delay={i * 100}>
              <div
                className={cn(
                  "flex h-full flex-col sm:px-7",
                  i > 0 && "sm:border-l sm:border-border",
                  // The 4-up row resets the divider at the wrap point, or the
                  // third column picks up a stray rule at sm.
                  i === 2 && "lg:border-l sm:border-l-0",
                  i === 0 && "sm:pl-0"
                )}
              >
                <p className="text-2xs font-bold uppercase tracking-[0.12em] text-primary">
                  {t(`${k}Eyebrow`)}
                </p>
                <p className="mt-3 text-[40px] font-bold leading-none tracking-[-0.03em] text-foreground lg:text-[52px]">
                  {t(`${k}Value`)}
                </p>
                <p className="mt-8 text-sm leading-relaxed text-muted-foreground lg:mt-auto lg:pt-10">
                  {t(`${k}Label`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-9 text-xs text-muted-foreground">{t("footnote")}</p>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------- testimonials */

const QUOTES = [
  { k: "1", grad: "from-[#FF6835] via-[#B8412A] to-[#14171F]", mono: "MA" },
  { k: "2", grad: "from-[#2563EB] via-[#1E3A8A] to-[#14171F]", mono: "TT" },
  { k: "3", grad: "from-[#7C55D6] via-[#4C2F8A] to-[#14171F]", mono: "PL" },
] as const;

const AWARDS = ["award1", "award2", "award3"] as const;

/**
 * Testimonials as tall portrait panels.
 *
 * The reference uses customer video stills. We have no photography, so each
 * card is a deep gradient carrying an oversized initial monogram — it holds the
 * same visual weight in the grid without pretending to be a photo.
 */
export function LandingTestimonials() {
  const t = useTranslations("landing.testimonials");

  return (
    <section aria-labelledby="testimonials-title" className="bg-canvas pb-20 md:pb-28">
      <Container>
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <Reveal className="max-w-[640px]">
            <DisplayTitle id="testimonials-title">{t("title")}</DisplayTitle>
          </Reveal>

          <Reveal delay={100}>
            <ul className="flex shrink-0 gap-3">
              {AWARDS.map((a) => (
                <li
                  key={a}
                  className="flex w-[124px] flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-3 text-center"
                >
                  <Award className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-foreground">
                    {t(`${a}Title`)}
                  </span>
                  <span className="text-[10px] font-medium text-text-disabled">
                    {t(`${a}Year`)}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.k} delay={i * 100}>
              <figure
                className={cn(
                  "relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-card bg-gradient-to-b p-6",
                  q.grad
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-5 top-2 select-none text-[140px] font-bold leading-none text-white/10"
                >
                  {q.mono}
                </span>

                <blockquote className="relative text-[17px] font-bold leading-snug text-white">
                  “{t(`quote${q.k}`)}”
                </blockquote>

                <figcaption className="relative mt-5 flex items-end justify-between gap-4">
                  <div className="text-xs leading-relaxed text-white/75">
                    <span className="block font-semibold text-white/90">
                      {t(`author${q.k}`)}
                    </span>
                    {t(`role${q.k}`)}
                  </div>
                  <span className="shrink-0 text-sm font-bold tracking-tight text-white">
                    {t(`company${q.k}`)}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <span aria-hidden className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-primary text-primary" />
            ))}
          </span>
          <span className="text-sm font-medium text-foreground">{t("rating")}</span>
          <CtaGhost href="#pricing" className="ml-auto">
            {t("more")}
          </CtaGhost>
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- security */

const SECURITY = [
  { Icon: MapPin, k: "dataResidency" },
  { Icon: Lock, k: "encryption" },
  { Icon: ShieldCheck, k: "rls" },
  { Icon: FileClock, k: "audit" },
] as const;

export function LandingSecurity() {
  const t = useTranslations("landing.security");

  return (
    <section className="bg-canvas py-14">
      <Container>
        <ul className="grid gap-8 sm:grid-cols-2 sm:gap-0 lg:grid-cols-4">
          {SECURITY.map(({ Icon, k }, i) => (
            <li
              key={k}
              className={cn(
                "flex flex-col items-center gap-2.5 text-center sm:px-6",
                i > 0 && "sm:border-l sm:border-border",
                i === 2 && "lg:border-l sm:border-l-0"
              )}
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t(k)}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------- cta */

/**
 * Closing band. A saturated gradient with the product mock clipped by the
 * band's bottom edge — the page's one big colour moment, deliberately held
 * back until the end.
 */
export function LandingCta() {
  const t = useTranslations("landing.cta");

  return (
    <section aria-labelledby="cta-title" className="bg-canvas pb-16 pt-6">
      <Container>
        <div
          className="relative overflow-hidden rounded-shell px-6 pt-16 md:pt-20"
          style={{
            background:
              "linear-gradient(135deg, #FF6835 0%, #F0455F 38%, #C43A9B 68%, #7C55D6 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.45) 0%, transparent 60%)",
            }}
          />

          <div className="relative mx-auto max-w-[800px] text-center">
            <Reveal>
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-[18px] bg-white shadow-elevated">
                <span className="text-2xl font-bold tracking-tight text-primary">V</span>
              </span>
            </Reveal>

            <Reveal delay={100}>
              <h2
                id="cta-title"
                className="mt-7 text-balance text-[30px] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[40px] lg:text-[50px]"
              >
                {t("title")}
              </h2>
            </Reveal>

            <Reveal delay={150}>
              <div className="mt-8 flex flex-col items-center gap-3.5">
                <CtaGhost
                  href="/login"
                  className="border-transparent bg-white text-foreground hover:border-transparent hover:bg-white/90"
                >
                  {t("primary")}
                </CtaGhost>
                <p className="text-xs text-white/75">{t("note")}</p>
              </div>
            </Reveal>
          </div>

          {/* Mock runs into the band's bottom edge and is cropped by it. There
              is intentionally no bottom padding here. */}
          <div aria-hidden className="relative mt-14 flex justify-center">
            <CtaAppMock />
          </div>
        </div>
      </Container>
    </section>
  );
}
