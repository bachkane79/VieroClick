import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Bell,
  BarChart3,
  Braces,
  Calendar,
  CalendarClock,
  CheckSquare,
  Clock,
  Columns3,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Flag,
  Folder,
  GanttChart,
  Gauge,
  Goal,
  Grid2x2,
  Hash,
  Inbox,
  LayoutGrid,
  Link2,
  ListChecks,
  ListTodo,
  Mail,
  Map,
  MessageSquare,
  Network,
  Palette,
  PenLine,
  Presentation,
  Puzzle,
  RefreshCw,
  Search,
  Send,
  Shapes,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Timer,
  UserRound,
  UsersRound,
  Video,
  Zap,
} from "lucide-react";
import { cn } from "@vieroc/ui";
import {
  Container,
  DisplayTitle,
  Eyebrow,
  MicroLabel,
  Reveal,
  SectionLead,
  SectionTitle,
} from "./landing-ui";
import { BrandMark, type BrandKey } from "./brand-marks";

/* ------------------------------------------------------------------ logos */

/**
 * Integration strip.
 *
 * This was a "trusted by" row of six invented company names set in the UI font,
 * which is both a customer claim the product cannot back and not actually a
 * logo. It now names the three services VieroClick genuinely connects to — the
 * Telegram bot (§2.8) and the GitHub + Google OAuth providers in
 * `server/auth/config.ts` — using their real marks. Naming a service you
 * interoperate with is a factual statement; implying it is a customer is not.
 *
 * ⚠️ `LIVE_INTEGRATIONS` is the set that actually exists in code. The rest of
 * the row is roadmap and ships here as a deliberate product call — keep the two
 * lists honest so nobody downstream mistakes the strip for a capability list.
 *
 * Eight marks do not fit beside the label, so the label sits on its own line
 * and the row spreads beneath it at `lg`. It wraps rather than scrolls: four
 * lockups per row on a 390px viewport, so the horizontal scroll rail the old
 * six text names needed is gone.
 *
 * Not `aria-hidden` any more either — these name real services, so the row
 * reads out as "Tích hợp với: Telegram, Zalo, Slack …".
 */
export const LIVE_INTEGRATIONS: BrandKey[] = ["telegram", "google", "github"];

// Optical sizing, not metric: solid marks (Telegram's disc, Figma's stacked
// circles) read heavier than open ones (Google's `G`, Jira's chevrons) at an
// identical box, so they run a hair smaller.
const INTEGRATIONS: Array<{
  brand: BrandKey;
  name: string;
  markClass: string;
  /** The mark already *is* the wordmark, so printing the name beside it would double it. */
  logotype?: boolean;
}> = [
  { brand: "telegram", name: "Telegram", markClass: "h-[21px] w-[21px]" },
  { brand: "zalo", name: "Zalo", markClass: "h-[17px] w-[45px]", logotype: true },
  { brand: "slack", name: "Slack", markClass: "h-[21px] w-[21px]" },
  { brand: "google", name: "Google", markClass: "h-[22px] w-[22px]" },
  { brand: "github", name: "GitHub", markClass: "h-[22px] w-[22px]" },
  { brand: "notion", name: "Notion", markClass: "h-[22px] w-[22px]" },
  { brand: "figma", name: "Figma", markClass: "h-[21px] w-[21px]" },
  { brand: "jira", name: "Jira", markClass: "h-[22px] w-[22px]" },
];

export function LandingLogos() {
  const t = useTranslations("landing.logos");

  return (
    <section className="bg-canvas py-10 md:py-12">
      <Container>
        <MicroLabel className="text-center lg:text-left">{t("title")}</MicroLabel>
        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 lg:flex-nowrap lg:justify-between lg:gap-x-4">
          {INTEGRATIONS.map(({ brand, name, markClass, logotype }) => (
            <li key={brand} className="flex items-center gap-2.5 text-text-secondary">
              <BrandMark brand={brand} className={markClass} />
              {logotype ? (
                <span className="sr-only">{name}</span>
              ) : (
                <span className="text-[15px] font-semibold tracking-tight">{name}</span>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- problem */

const PROBLEM_STATIONS = [
  { key: "card1", time: "08:15", kind: "done", layers: 0 },
  { key: "card2", time: "10:30", kind: "changed", layers: 1 },
  { key: "card3", time: "13:45", kind: "unassigned", layers: 2 },
  { key: "card4", time: "15:20", kind: "waiting", layers: 3 },
  { key: "card5", time: "16:50", kind: "blocked", layers: 4 },
  { key: "card6", time: "17:35", kind: "report", layers: 5 },
] as const;

/** A day of status-chasing, with follow-up work accumulating after every change. */
export function LandingProblem() {
  const t = useTranslations("landing.problem");

  return (
    <section
      aria-labelledby="problem-title"
      className="overflow-hidden border-t border-border bg-canvas py-16 md:py-20"
    >
      <Container>
        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <SectionTitle id="problem-title" className="mt-4 max-w-[570px] lg:text-[40px]">
              {t("title")}
            </SectionTitle>
          </Reveal>
          <Reveal delay={100} className="lg:pt-9">
            <SectionLead className="max-w-[570px] lg:text-xl">{t("lead")}</SectionLead>
          </Reveal>
        </div>

        <Reveal delay={150} className="mt-14 md:mt-16">
          <div className="flex flex-col items-start justify-between gap-2 border-b border-border pb-4 sm:flex-row sm:items-end">
            <MicroLabel className="text-foreground">{t("timelineLabel")}</MicroLabel>
            <p className="text-sm font-medium text-muted-foreground">{t("timelineDescription")}</p>
          </div>

          <ol className="relative mt-8 flex flex-col lg:mt-12 lg:grid lg:grid-cols-6">
            {PROBLEM_STATIONS.map((station, stationIndex) => {
              const isFinal = station.kind === "report";

              return (
                <li
                  key={station.key}
                  className="group relative flex w-full items-stretch lg:flex-col lg:items-center"
                >
                  <div className="relative flex w-[80px] shrink-0 pb-10 pt-4 lg:hidden">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[54px] w-px bg-border",
                        stationIndex === 0
                          ? "bottom-0 top-[26px]"
                          : isFinal
                            ? "top-0 h-[26px]"
                            : "inset-y-0"
                      )}
                    />
                    <time className="mt-[5px] w-[42px] text-right text-sm font-medium text-muted-foreground">
                      {station.time}
                    </time>
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[49.5px] top-[26px] z-10 h-2.5 w-2.5 rounded-full ring-4 ring-canvas",
                        isFinal ? "bg-destructive" : "bg-foreground"
                      )}
                    />
                  </div>

                  <div className="relative z-10 flex flex-1 flex-col items-start justify-start py-4 pl-2 lg:h-[196px] lg:w-full lg:items-center lg:justify-end lg:pb-9 lg:pl-0 lg:pt-0">
                    <div className="relative w-full max-w-[300px] lg:w-[calc(100%-16px)] lg:max-w-[196px]">
                      {Array.from({ length: station.layers }, (_, layerIndex) => {
                        const depth = station.layers - layerIndex;
                        return (
                          <span
                            key={layerIndex}
                            aria-hidden
                            style={{
                              transform: `translate(${Math.min(depth + 1, 5)}px, -${depth * 3}px) rotate(${depth % 2 === 0 ? -depth : depth}deg)`,
                              zIndex: layerIndex,
                            }}
                            className={cn(
                              "absolute inset-0 rounded-xl border border-border",
                              layerIndex % 2 === 0
                                ? "bg-surface-subtle"
                                : "bg-[hsl(var(--landing-card))]"
                            )}
                          />
                        );
                      })}

                      <div className="relative z-10 flex min-h-[48px] items-start gap-2.5 rounded-xl border border-border bg-[hsl(var(--landing-card))] px-4 py-3">
                        {station.kind === "done" && (
                          <span
                            aria-hidden
                            className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                          />
                        )}
                        {station.kind === "changed" && (
                          <RefreshCw
                            aria-hidden
                            className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          />
                        )}
                        {station.kind === "unassigned" && (
                          <span aria-hidden className="mt-0.5 flex shrink-0 -space-x-1.5">
                            <span className="h-4 w-4 rounded-full border border-dashed border-border-strong bg-canvas" />
                            <span className="h-4 w-4 rounded-full border border-dashed border-border-strong bg-canvas" />
                          </span>
                        )}
                        {station.kind === "waiting" && (
                          <span
                            aria-hidden
                            className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-text-disabled"
                          />
                        )}
                        {station.kind === "blocked" && (
                          <AlertCircle
                            aria-hidden
                            className="mt-[3px] h-3.5 w-3.5 shrink-0 text-warning"
                          />
                        )}
                        {station.kind === "report" && (
                          <FileWarning
                            aria-hidden
                            className="mt-[3px] h-3.5 w-3.5 shrink-0 text-destructive"
                          />
                        )}
                        <span className="text-sm font-semibold leading-[1.45] text-foreground xl:text-[15px]">
                          {t(station.key)}
                        </span>
                      </div>
                    </div>

                    {isFinal && (
                      <p className="mt-6 max-w-[260px] text-sm font-medium leading-snug text-destructive lg:hidden">
                        {t("conclusion")}
                      </p>
                    )}
                  </div>

                  <div className="relative hidden h-[78px] w-full flex-col items-center lg:flex">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1 h-px bg-border",
                        stationIndex === 0
                          ? "left-1/2 right-0"
                          : isFinal
                            ? "left-0 right-1/2"
                            : "inset-x-0"
                      )}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "relative z-10 mt-0.5 h-2.5 w-2.5 rounded-full ring-4 ring-canvas",
                        isFinal ? "bg-destructive" : "bg-foreground"
                      )}
                    />
                    <time className="mt-4 text-sm font-medium text-muted-foreground">
                      {station.time}
                    </time>
                    {isFinal && (
                      <p className="absolute top-[56px] w-[220px] text-center text-xs font-medium leading-snug text-destructive">
                        {t("conclusion")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- views grid */

/** The 44 small tiles. Order is grid order, wrapping around the four big cards. */
const TILES = [
  { Icon: Network, k: "dependencies" },
  { Icon: Search, k: "search" },
  { Icon: ListTodo, k: "tasks" },
  { Icon: Shapes, k: "mindmap" },
  { Icon: FileText, k: "wiki" },
  { Icon: Sparkles, k: "aiNotes" },
  { Icon: Calendar, k: "calendar" },
  { Icon: Stamp, k: "proofing" },
  { Icon: Folder, k: "portfolio" },
  { Icon: Palette, k: "templates" },

  { Icon: Bell, k: "reminders" },
  { Icon: BarChart3, k: "reporting" },
  { Icon: Goal, k: "goals" },
  { Icon: Zap, k: "sprints" },
  { Icon: Signal, k: "statuses" },
  { Icon: PenLine, k: "aiWriter" },

  { Icon: Braces, k: "api" },
  { Icon: Flag, k: "milestones" },
  { Icon: ListChecks, k: "forms" },
  { Icon: SlidersHorizontal, k: "automation" },
  { Icon: Columns3, k: "customFields" },
  { Icon: Clock, k: "timesheets" },

  { Icon: MessageSquare, k: "aiQa" },
  { Icon: Gauge, k: "priority" },
  { Icon: Timer, k: "estimates" },
  { Icon: Video, k: "clips" },
  { Icon: LayoutGrid, k: "everything" },
  { Icon: ShieldCheck, k: "sso" },

  { Icon: Mail, k: "email" },
  { Icon: Grid2x2, k: "dashboards" },
  { Icon: Clock, k: "timeTracking" },
  { Icon: Columns3, k: "kanban" },
  { Icon: Puzzle, k: "integrations" },
  { Icon: UserRound, k: "guests" },

  { Icon: Hash, k: "tags" },
  { Icon: Inbox, k: "support" },
  { Icon: CheckSquare, k: "checklists" },
  { Icon: CalendarClock, k: "scheduling" },
  { Icon: FileSpreadsheet, k: "sheets" },
  { Icon: Presentation, k: "whiteboards" },
  { Icon: GanttChart, k: "gantt" },
  { Icon: Map, k: "roadmap" },
  { Icon: Link2, k: "inbox" },
  { Icon: UsersRound, k: "teams" },
] as const;

const BIG_CARDS = [
  {
    k: "projects",
    Icon: LayoutGrid,
    wash: "bg-brand-soft",
    chip: "bg-primary",
    pos: "col-start-4 row-start-2",
  },
  {
    k: "docs",
    Icon: FileText,
    wash: "bg-sky-soft",
    chip: "bg-sky",
    pos: "col-start-6 row-start-2",
  },
  {
    k: "ai",
    Icon: Sparkles,
    wash: "bg-lavender-soft",
    chip: "bg-lavender",
    pos: "col-start-4 row-start-4",
  },
  {
    k: "telegram",
    Icon: Send,
    wash: "bg-mint-soft",
    chip: "bg-mint",
    pos: "col-start-6 row-start-4",
  },
] as const;

/**
 * The feature lattice.
 *
 * A 10x6 grid, wider than the container, faded out at both edges by a mask so
 * it reads as a slice of something larger. Four central 2x2 cells are promoted
 * into product cards; the small tiles auto-flow around them, which is why the
 * big cards carry explicit grid positions and the tiles carry none.
 */
export function LandingViewsGrid() {
  const t = useTranslations("landing.grid");

  return (
    <section aria-labelledby="grid-title" className="overflow-hidden bg-canvas py-20 md:py-28">
      <Container>
        <Reveal className="mx-auto max-w-[780px] text-center">
          <DisplayTitle id="grid-title">{t("title")}</DisplayTitle>
        </Reveal>
        <Reveal delay={100}>
          <SectionLead className="mx-auto mt-5 max-w-[56ch] text-center text-base">
            {t("lead")}
          </SectionLead>
        </Reveal>
      </Container>

      <Reveal delay={150}>
        <div
          aria-hidden
          className="mt-14 w-full [mask-image:linear-gradient(to_right,transparent,black_16%,black_84%,transparent)]"
        >
          <div className="mx-auto grid w-[1680px] grid-cols-10 grid-rows-6 gap-px bg-border">
            {BIG_CARDS.map((c) => (
              <div
                key={c.k}
                className={cn(
                  "col-span-2 row-span-2 flex flex-col justify-between p-5",
                  c.wash,
                  c.pos
                )}
              >
                <div className="flex flex-1 items-center justify-center">
                  <BigCardMock k={c.k} />
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-white",
                      c.chip
                    )}
                  >
                    <c.Icon className="h-4 w-4" />
                  </span>
                  <span className="text-2xl font-bold tracking-[-0.02em] text-foreground">
                    {t(`${c.k}Name`)}
                  </span>
                </div>
              </div>
            ))}

            {TILES.map(({ Icon, k }, i) => (
              <div
                key={`${k}-${i}`}
                className="flex aspect-square flex-col items-center justify-center gap-2.5 bg-[hsl(var(--landing-card))] p-3"
              >
                <Icon className="h-[22px] w-[22px] text-muted-foreground" />
                <span className="text-center text-xs font-medium leading-tight text-muted-foreground">
                  {t(k)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** The four mini product mocks that sit inside the promoted grid cards. */
function BigCardMock({ k }: { k: string }) {
  if (k === "projects") {
    return (
      <div className="w-full space-y-2">
        <div className="rounded-lg border border-border bg-surface p-2.5 shadow-soft">
          <span className="inline-flex items-center gap-1 rounded-full bg-peach-soft px-2 py-0.5 text-[9px] font-bold text-peach">
            <span className="h-1 w-1 rounded-full bg-current" />
            CẦN CẬP NHẬT
          </span>
          <div className="mt-2 h-1.5 w-4/5 rounded-full bg-surface-hover" />
          <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-surface-hover" />
        </div>
        <div className="ml-5 rounded-lg border border-border bg-surface p-2.5 shadow-soft">
          <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[9px] font-bold text-mint">
            <span className="h-1 w-1 rounded-full bg-current" />
            HOÀN THÀNH
          </span>
          <div className="mt-2 h-1.5 w-3/4 rounded-full bg-surface-hover" />
        </div>
      </div>
    );
  }

  if (k === "docs") {
    return (
      <div className="relative w-full">
        <div className="absolute -right-2 -top-2 h-full w-full rounded-lg border border-border bg-surface/70" />
        <div className="relative rounded-lg border border-border bg-surface p-3 shadow-soft">
          <div className="h-1.5 w-1/3 rounded-full bg-primary" />
          <div className="mt-2.5 space-y-1.5">
            {["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"].map((w, i) => (
              <div key={i} className={cn("h-1.5 rounded-full bg-surface-hover", w)} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (k === "ai") {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 shadow-soft">
          <span className="flex-1 text-[10px] text-text-disabled">Tuần này mình bỏ lỡ gì?</span>
          <Sparkles className="h-3 w-3 text-lavender" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-soft">
          <span className="flex-1 text-[10px] font-semibold text-foreground">Chiến dịch Q3</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary">
            <span className="h-1 w-1 rounded-full bg-current" />
            ĐANG LÀM
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="max-w-[80%] rounded-xl rounded-bl-sm border border-border bg-surface px-2.5 py-1.5 text-[10px] text-foreground shadow-soft">
        Cập nhật tiến độ dự án nhé.
      </div>
      <div className="ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-primary px-2.5 py-1.5 text-[10px] text-primary-foreground">
        Đã gửi báo cáo sáng nay.
      </div>
      <div className="max-w-[85%] rounded-xl rounded-bl-sm border border-border bg-surface px-2.5 py-1.5 text-[10px] text-foreground shadow-soft">
        Tuyệt vời, mình review sau.
      </div>
    </div>
  );
}
