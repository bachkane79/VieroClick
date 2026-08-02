import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Container, DisplayTitle, Reveal, SectionLead } from "./landing-ui";

const FAQ_ITEMS = ["free", "agents", "approval", "teams", "telegram"] as const;

export function LandingFaq() {
  const t = useTranslations("landing.faq");

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="border-y border-border bg-surface-subtle py-16 md:py-20"
    >
      <Container className="max-w-[1080px]">
        <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <Reveal>
            <DisplayTitle id="faq-title">{t("title")}</DisplayTitle>
            <SectionLead className="mt-5 max-w-[36ch] text-base">{t("lead")}</SectionLead>
          </Reveal>

          <Reveal delay={100}>
            <div className="border-t border-border">
              {FAQ_ITEMS.map((item, index) => (
                <details key={item} className="group border-b border-border" open={index === 0}>
                  <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring [&::-webkit-details-marker]:hidden">
                    <span className="flex-1 text-base font-semibold leading-snug text-foreground">
                      {t(`${item}Question`)}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none">
                      <Plus aria-hidden className="h-4 w-4" />
                    </span>
                  </summary>
                  <p className="max-w-[68ch] pb-6 pr-14 text-sm leading-relaxed text-muted-foreground">
                    {t(`${item}Answer`)}
                  </p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
