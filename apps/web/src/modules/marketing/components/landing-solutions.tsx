"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  Code,
  FolderKanban,
  Kanban,
  ListChecks,
  Megaphone,
  Radar,
  Settings2,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@vieroc/ui";
import { Container, CtaDark, DisplayTitle, Reveal, SectionLead } from "./landing-ui";

const TEAM_TABS = ["projects", "marketing", "product", "ops", "hr", "leadership"] as const;
type TeamKey = (typeof TEAM_TABS)[number];

const TEAM_META = {
  projects: {
    icon: FolderKanban,
    stage: "bg-brand-soft",
    iconTone: "bg-primary text-primary-foreground",
    bars: ["bg-primary", "bg-ai", "bg-mint"],
  },
  marketing: {
    icon: Megaphone,
    stage: "bg-lavender-soft",
    iconTone: "bg-ai text-ai-foreground",
    bars: ["bg-ai", "bg-primary", "bg-sky"],
  },
  product: {
    icon: Code,
    stage: "bg-sky-soft",
    iconTone: "bg-sky text-white",
    bars: ["bg-sky", "bg-ai", "bg-primary"],
  },
  ops: {
    icon: Settings2,
    stage: "bg-mint-soft",
    iconTone: "bg-mint text-white",
    bars: ["bg-mint", "bg-primary", "bg-ai"],
  },
  hr: {
    icon: Users,
    stage: "bg-peach-soft",
    iconTone: "bg-peach text-foreground",
    bars: ["bg-peach", "bg-mint", "bg-primary"],
  },
  leadership: {
    icon: BarChart3,
    stage: "bg-brand-soft",
    iconTone: "bg-foreground text-white",
    bars: ["bg-primary", "bg-mint", "bg-sky"],
  },
} satisfies Record<
  TeamKey,
  { icon: LucideIcon; stage: string; iconTone: string; bars: [string, string, string] }
>;

const PRIMARY_VIEW_KEYS = {
  projects: "mockPlan",
  marketing: "mockCalendar",
  product: "mockBoard",
  ops: "mockPipeline",
  hr: "mockOnboarding",
  leadership: "mockPortfolio",
} as const;

/** Per-team solutions presented as a real tabbed product story. */
export function LandingSolutions() {
  const t = useTranslations("landing.solutions");
  const [active, setActive] = useState<TeamKey>("projects");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const meta = TEAM_META[active];
  const ActiveIcon = meta.icon;
  const points: [string, string, string] = [
    t(`${active}Point1`),
    t(`${active}Point2`),
    t(`${active}Point3`),
  ];
  const agents: [string, string, string, string] = [
    t(`${active}Agent1`),
    t(`${active}Agent2`),
    t(`${active}Agent3`),
    t(`${active}Agent4`),
  ];
  const mockLabels = {
    workstreams: t("mockWorkstreams"),
    timeline: t("mockTimeline"),
    calendar: t("mockCalendar"),
    board: t("mockBoard"),
    pipeline: t("mockPipeline"),
    onboarding: t("mockOnboarding"),
    portfolio: t("mockPortfolio"),
    backlog: t("mockBacklog"),
    inProgress: t("mockInProgress"),
    review: t("mockReview"),
    complete: t("mockComplete"),
    health: t("mockHealth"),
    owner: t("mockOwner"),
    status: t("mockStatus"),
  };

  function selectTab(index: number) {
    const next = TEAM_TABS[index];
    if (!next) return;
    setActive(next);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab((index + 1) % TEAM_TABS.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab((index - 1 + TEAM_TABS.length) % TEAM_TABS.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab(TEAM_TABS.length - 1);
    }
  }

  return (
    <section
      aria-labelledby="solutions-title"
      id="solutions"
      className="border-y border-border bg-surface-subtle py-16 md:py-20"
    >
      <Container>
        <Reveal className="mx-auto max-w-[760px] text-center">
          <DisplayTitle id="solutions-title">{t("title")}</DisplayTitle>
          <SectionLead className="mx-auto mt-5 max-w-[58ch] text-base">{t("lead")}</SectionLead>
        </Reveal>

        <Reveal delay={100}>
          <div
            role="tablist"
            aria-label={t("tablistLabel")}
            className="no-scrollbar mx-auto mt-10 flex max-w-[1040px] overflow-x-auto border-b border-border md:justify-center"
          >
            {TEAM_TABS.map((key, index) => (
              <button
                key={key}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`solution-tab-${key}`}
                type="button"
                role="tab"
                tabIndex={active === key ? 0 : -1}
                aria-selected={active === key}
                aria-controls="solutions-panel"
                onClick={() => setActive(key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={cn(
                  "relative min-h-[56px] shrink-0 px-5 pb-5 pt-3 text-sm font-semibold transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
                  active === key
                    ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`${key}Tab`)}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div
            id="solutions-panel"
            role="tabpanel"
            aria-labelledby={`solution-tab-${active}`}
            className="mt-12 grid min-w-0 overflow-hidden rounded-shell border border-border bg-[hsl(var(--landing-card))] lg:min-h-[640px] lg:grid-cols-[44fr_56fr]"
          >
            <div
              key={`${active}-copy`}
              className="animate-fade-in px-7 py-10 motion-reduce:animate-none sm:px-10 sm:py-12 lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-16"
            >
              <h3 className="text-balance text-[30px] font-bold leading-[1.1] tracking-[-0.025em] text-foreground sm:text-[38px]">
                {t(`${active}HeadA`)}
                <br />
                {t(`${active}HeadB`)}{" "}
                <span className="text-text-disabled">{t(`${active}HeadC`)}</span>
              </h3>

              <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
                {t(`${active}Body`)}
              </p>

              <div className="my-8 h-px w-20 bg-border" />

              <ul className="space-y-4">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-strong text-muted-foreground">
                      <Check aria-hidden className="h-3 w-3" strokeWidth={2} />
                    </span>
                    <span className="text-sm leading-relaxed text-foreground">{point}</span>
                  </li>
                ))}
              </ul>

              <CtaDark href="#pricing" className="mt-9 self-start">
                {t("cta")}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </CtaDark>
            </div>

            <div
              className={cn(
                "relative min-h-[500px] min-w-0 overflow-hidden border-t border-border lg:min-h-0 lg:border-l lg:border-t-0",
                "bg-[radial-gradient(circle_at_center,hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px]",
                meta.stage
              )}
            >
              <div
                key={`${active}-mock`}
                aria-hidden
                className="absolute -bottom-10 left-5 right-[-132px] top-9 animate-fade-in overflow-hidden rounded-tl-[20px] border border-border bg-surface shadow-elevated motion-reduce:animate-none sm:left-10 sm:right-[-92px] sm:top-12 lg:left-12 lg:right-[-150px] lg:top-14"
              >
                <div className="flex h-[72px] items-center gap-3 border-b border-border px-5 sm:px-7">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      meta.iconTone
                    )}
                  >
                    <ActiveIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {t("workspace", { team: t(`${active}Tab`) })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t("mockAiRunning")}</p>
                  </div>
                  <span className="ml-auto hidden shrink-0 items-center gap-2 rounded-full bg-mint-soft px-3 py-1.5 text-xs font-semibold text-mint sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                    {t("mockOnTrack")}
                  </span>
                </div>

                <div className="flex h-11 items-end gap-6 border-b border-border px-5 text-xs text-muted-foreground sm:px-7">
                  <span className="flex h-full items-center border-b-2 border-primary font-semibold text-foreground">
                    {t(PRIMARY_VIEW_KEYS[active])}
                  </span>
                  <span className="flex h-full items-center">{t("mockActivity")}</span>
                  <span className="flex h-full items-center">{t("mockReports")}</span>
                </div>

                <SolutionMockBody
                  active={active}
                  points={points}
                  agents={agents}
                  bars={meta.bars}
                  labels={mockLabels}
                />
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function TimelineBar({
  className,
  tone,
  label,
}: {
  className: string;
  tone: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "absolute flex h-10 items-center gap-2 rounded-lg px-3 text-white shadow-xs",
        className,
        tone
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/20">
        <Bot className="h-3 w-3" />
      </span>
      <span className="truncate text-xs font-semibold">{label}</span>
    </div>
  );
}

type MockLabels = {
  workstreams: string;
  timeline: string;
  calendar: string;
  board: string;
  pipeline: string;
  onboarding: string;
  portfolio: string;
  backlog: string;
  inProgress: string;
  review: string;
  complete: string;
  health: string;
  owner: string;
  status: string;
};

type SolutionMockProps = {
  points: [string, string, string];
  agents: [string, string, string, string];
  bars: [string, string, string];
  labels: MockLabels;
};

function SolutionMockBody({
  active,
  points,
  agents,
  bars,
  labels,
}: SolutionMockProps & { active: TeamKey }) {
  const props = { points, agents, bars, labels };

  switch (active) {
    case "marketing":
      return <MarketingCalendar {...props} />;
    case "product":
      return <ProductBoard {...props} />;
    case "ops":
      return <OperationsPipeline {...props} />;
    case "hr":
      return <PeopleOnboarding {...props} />;
    case "leadership":
      return <LeadershipPortfolio {...props} />;
    default:
      return <ProjectTimeline {...props} />;
  }
}

function ProjectTimeline({ points, agents, bars, labels }: SolutionMockProps) {
  return (
    <div className="grid h-[calc(100%-116px)] min-h-[390px] grid-cols-[minmax(560px,1fr)] bg-surface md:grid-cols-[180px_minmax(560px,1fr)]">
      <div className="hidden border-r border-border bg-surface md:block">
        <div className="flex h-14 items-center border-b border-border px-5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {labels.workstreams}
        </div>
        {points.map((point, index) => (
          <div
            key={point}
            className="flex h-[102px] items-start gap-2.5 border-b border-border px-5 py-5"
          >
            <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", bars[index])} />
            <span className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground">
              {point}
            </span>
          </div>
        ))}
      </div>

      <div className="relative min-w-[560px] overflow-hidden bg-surface">
        <div className="flex h-14 items-center border-b border-border px-5">
          <span className="text-xs font-semibold text-foreground">{labels.timeline}</span>
          <div className="ml-8 grid flex-1 grid-cols-5 text-center text-xs text-muted-foreground">
            {["01", "02", "03", "04", "05"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-14 grid grid-cols-5 pl-[76px]">
          {[0, 1, 2, 3, 4].map((column) => (
            <span
              key={column}
              className={cn(
                "border-l border-border/70",
                (column === 2 || column === 3) && "bg-surface-subtle/70"
              )}
            />
          ))}
        </div>

        <TimelineBar className="left-[8%] top-[82px] w-[48%]" tone={bars[0]} label={agents[0]} />
        <TimelineBar className="left-[33%] top-[184px] w-[52%]" tone={bars[1]} label={agents[1]} />
        <TimelineBar className="left-[16%] top-[286px] w-[66%]" tone={bars[2]} label={agents[2]} />

        <AgentNote className="left-[58%] top-[342px]" label={agents[3]} />
      </div>
    </div>
  );
}

function MarketingCalendar({ points, agents, bars, labels }: SolutionMockProps) {
  return (
    <div className="h-[calc(100%-116px)] min-h-[390px] min-w-[620px] bg-surface p-6">
      <MockHeading icon={CalendarDays} title={labels.calendar} detail="01 - 05" />
      <div className="mt-5 overflow-hidden rounded-xl border border-border">
        <div className="grid h-10 grid-cols-5 border-b border-border bg-surface-subtle text-center text-xs text-muted-foreground">
          {["01", "02", "03", "04", "05"].map((day) => (
            <span
              key={day}
              className="flex items-center justify-center border-r border-border last:border-r-0"
            >
              {day}
            </span>
          ))}
        </div>
        <CalendarLane
          point={points[0]}
          agent={agents[0]}
          tone={bars[0]}
          position="left-[4%] w-[42%]"
        />
        <CalendarLane
          point={points[1]}
          agent={agents[1]}
          tone={bars[1]}
          position="left-[28%] w-[50%]"
        />
        <CalendarLane
          point={points[2]}
          agent={agents[2]}
          tone={bars[2]}
          position="left-[54%] w-[42%]"
        />
      </div>
      <AgentNote className="bottom-5 right-6" label={agents[3]} />
    </div>
  );
}

function CalendarLane({
  point,
  agent,
  tone,
  position,
}: {
  point: string;
  agent: string;
  tone: string;
  position: string;
}) {
  return (
    <div className="relative grid h-[88px] grid-cols-5 border-b border-border last:border-b-0">
      {[0, 1, 2, 3, 4].map((cell) => (
        <span key={cell} className="border-r border-border/70 last:border-r-0" />
      ))}
      <div
        className={cn(
          "absolute top-3 flex h-[62px] items-center gap-2 rounded-lg px-3 text-white shadow-xs",
          position,
          tone
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/20">
          <Megaphone className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold">{point}</span>
          <span className="mt-0.5 block truncate text-[10px] text-white/80">{agent}</span>
        </span>
      </div>
    </div>
  );
}

function ProductBoard({ points, agents, bars, labels }: SolutionMockProps) {
  const columns = [labels.backlog, labels.inProgress, labels.review] as const;

  return (
    <div className="h-[calc(100%-116px)] min-h-[390px] min-w-[640px] bg-surface-subtle/60 p-6">
      <MockHeading icon={Kanban} title={labels.board} detail={labels.status} />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {columns.map((column, index) => (
          <div key={column} className="min-h-[310px] rounded-xl bg-surface p-3 shadow-xs">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{column}</span>
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] text-muted-foreground">
                {index + 1}
              </span>
            </div>
            <div className="rounded-lg border border-border p-3">
              <span className={cn("mb-3 block h-1.5 w-10 rounded-full", bars[index])} />
              <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-foreground">
                {points[index]}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                <Bot className="h-3 w-3" />
                <span className="truncate">{agents[index]}</span>
              </div>
            </div>
            {index === 1 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-lavender-soft/60 p-3">
                <div className="flex items-center gap-2 text-ai">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="truncate text-[10px] font-semibold">{agents[3]}</span>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationsPipeline({ points, agents, bars, labels }: SolutionMockProps) {
  return (
    <div className="h-[calc(100%-116px)] min-h-[390px] min-w-[660px] bg-surface p-6">
      <MockHeading icon={Zap} title={labels.pipeline} detail={labels.status} />
      <div className="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
        {points.map((point, index) => (
          <div key={point} className="contents">
            <div className="min-w-0 rounded-xl border border-border bg-surface-subtle/50 p-4">
              <span
                className={cn(
                  "mb-4 flex h-9 w-9 items-center justify-center rounded-lg text-white",
                  bars[index]
                )}
              >
                {index === 0 ? <ListChecks className="h-4 w-4" /> : null}
                {index === 1 ? <Zap className="h-4 w-4" /> : null}
                {index === 2 ? <CheckCircle2 className="h-4 w-4" /> : null}
              </span>
              <p className="line-clamp-2 min-h-[42px] text-xs font-semibold leading-relaxed text-foreground">
                {point}
              </p>
              <p className="mt-3 truncate text-[10px] text-muted-foreground">{agents[index]}</p>
            </div>
            {index < points.length - 1 ? (
              <ArrowRight className="h-4 w-4 text-border-strong" />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-mint-soft px-4 py-3 text-mint">
        <Radar className="h-4 w-4 shrink-0" />
        <span className="truncate text-xs font-semibold">{agents[3]}</span>
      </div>
    </div>
  );
}

function PeopleOnboarding({ points, agents, bars, labels }: SolutionMockProps) {
  return (
    <div className="h-[calc(100%-116px)] min-h-[390px] min-w-[640px] bg-surface-subtle/60 p-6">
      <MockHeading icon={Users} title={labels.onboarding} detail={labels.owner} />
      <div className="mt-5 grid grid-cols-[1.35fr_0.65fr] gap-4">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {points.map((point, index) => (
            <div
              key={point}
              className="flex min-h-[92px] items-center gap-3 border-b border-border p-4 last:border-b-0"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  index === 0
                    ? "bg-mint-soft text-mint"
                    : "border border-border text-muted-foreground"
                )}
              >
                {index === 0 ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-[10px]">{index + 1}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{point}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">{agents[index]}</p>
              </div>
              <span className={cn("h-1.5 w-12 shrink-0 rounded-full", bars[index])} />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-peach-soft text-sm font-bold text-foreground">
            VC
          </span>
          <p className="mt-3 text-xs font-semibold text-foreground">{labels.onboarding}</p>
          <div className="mt-5 space-y-2">
            {["w-full", "w-4/5", "w-3/5", "w-2/5"].map((width, index) => (
              <span key={width} className="block h-2 rounded-full bg-surface-subtle">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    width,
                    index === 0 ? "bg-mint" : "bg-primary/70"
                  )}
                />
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-lavender-soft p-3 text-left text-ai">
            <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-3 text-[10px] font-semibold leading-relaxed">
              {agents[3]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadershipPortfolio({ points, agents, bars, labels }: SolutionMockProps) {
  return (
    <div className="h-[calc(100%-116px)] min-h-[390px] min-w-[650px] bg-surface-subtle/60 p-6">
      <MockHeading icon={BarChart3} title={labels.portfolio} detail={labels.health} />
      <div className="mt-5 grid grid-cols-[1.35fr_0.65fr] gap-4">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[1fr_110px_82px] border-b border-border bg-surface-subtle px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <span>{labels.workstreams}</span>
            <span>{labels.health}</span>
            <span>{labels.status}</span>
          </div>
          {points.map((point, index) => (
            <div
              key={point}
              className="grid min-h-[78px] grid-cols-[1fr_110px_82px] items-center border-b border-border px-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{point}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">{agents[index]}</p>
              </div>
              <span className="mr-5 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    bars[index],
                    ["w-4/5", "w-3/5", "w-2/3"][index]
                  )}
                />
              </span>
              <span
                className={cn(
                  "w-fit rounded-full px-2 py-1 text-[10px] font-semibold",
                  index === 1 ? "bg-peach-soft text-foreground" : "bg-mint-soft text-mint"
                )}
              >
                {index === 1 ? labels.review : labels.complete}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col rounded-xl bg-foreground p-4 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Radar className="h-4 w-4" />
          </span>
          <p className="mt-4 text-xs font-semibold">{labels.health}</p>
          <div className="mt-4 flex items-end gap-1.5">
            {["h-10", "h-16", "h-12", "h-24", "h-20", "h-28"].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={cn(
                  "w-5 rounded-t-sm",
                  height,
                  index === 3 ? "bg-primary" : "bg-white/20"
                )}
              />
            ))}
          </div>
          <div className="mt-auto flex items-start gap-2 border-t border-white/10 pt-4">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-peach" />
            <span className="line-clamp-3 text-[10px] leading-relaxed text-white/75">
              {agents[3]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockHeading({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex h-9 items-center gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-semibold text-foreground">{title}</span>
      <span className="ml-auto rounded-full bg-surface-subtle px-2.5 py-1 text-[10px] text-muted-foreground">
        {detail}
      </span>
    </div>
  );
}

function AgentNote({ className, label }: { className: string; label: string }) {
  return (
    <div
      className={cn(
        "absolute flex max-w-[250px] items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-soft",
        className
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-lavender-soft text-ai">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <span className="truncate text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}
