"use client";

import { useRef, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@vieroc/ui";
import { Container, Eyebrow, Reveal, SectionLead, SectionTitle } from "./landing-ui";
import { AppChrome } from "./mocks/app-chrome";
import { BoardMock, CalendarMock, ListMock, OverviewMock, ReportMock } from "./mocks/view-mocks";

const VIEWS = ["overview", "list", "board", "calendar", "report"] as const;
type ViewKey = (typeof VIEWS)[number];

const PANELS: Record<ViewKey, ComponentType> = {
  overview: OverviewMock,
  list: ListMock,
  board: BoardMock,
  calendar: CalendarMock,
  report: ReportMock,
};

/**
 * Tabbed showcase of the five project views.
 *
 * Only the active panel is mounted, so the frame always hugs its content —
 * rendering all five and hiding four leaves the tallest one dictating the
 * frame height and produces a large dead region under the short panels.
 */
export function LandingViews() {
  const t = useTranslations("landing.views");
  const [active, setActive] = useState<ViewKey>("overview");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + VIEWS.length) % VIEWS.length;
    setActive(VIEWS[next]!);
    tabRefs.current[next]?.focus();
  };

  const Panel = PANELS[active];

  return (
    <section id="views" aria-labelledby="views-title" className="bg-canvas py-20 md:py-28">
      <Container>
        <Reveal className="text-center">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle as="h2" className="mx-auto mt-3 max-w-[18ch]">
            <span id="views-title">{t("title")}</span>
          </SectionTitle>
          <SectionLead className="mx-auto mt-4 max-w-[52ch]">{t("lead")}</SectionLead>
        </Reveal>

        <div className="mt-8 flex justify-center">
          <div
            role="tablist"
            aria-label={t("tablistLabel")}
            className="no-scrollbar flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-full border border-border bg-surface-subtle p-1"
          >
            {VIEWS.map((key, i) => (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`view-tab-${key}`}
                aria-selected={active === key}
                aria-controls="view-panel"
                tabIndex={active === key ? 0 : -1}
                onClick={() => setActive(key)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  active === key
                    ? "bg-brand-soft text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        <Reveal delay={100} className="mt-8">
          <AppChrome decorative={false} className="shadow-soft">
            <div
              key={active}
              role="tabpanel"
              id="view-panel"
              aria-labelledby={`view-tab-${active}`}
              className="min-w-0 animate-fade-in"
            >
              <Panel />
            </div>
          </AppChrome>
        </Reveal>
      </Container>
    </section>
  );
}
