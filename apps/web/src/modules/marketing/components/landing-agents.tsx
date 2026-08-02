"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@vieroc/ui";
import { Reveal } from "./landing-ui";

const STAGES = ["planning", "assignment", "tracking", "risk", "reporting"] as const;

type Stage = (typeof STAGES)[number];

const IMAGES: Record<Stage, string> = {
  planning: "/landing/lifecycle/planning.jpg",
  assignment: "/landing/lifecycle/assignment.jpg",
  tracking: "/landing/lifecycle/tracking.jpg",
  risk: "/landing/lifecycle/risk.jpg",
  reporting: "/landing/lifecycle/reporting.jpg",
};

const canvasClass =
  "relative h-[390px] w-full overflow-hidden rounded-shell bg-surface-subtle shadow-[0_3px_3px_rgba(0,0,0,0.03),0_12px_18px_rgba(0,0,0,0.06),0_36px_64px_rgba(0,0,0,0.12)] sm:h-[460px] lg:h-[520px]";

const panelClass =
  "border border-border bg-surface shadow-[0_1px_1px_rgba(0,0,0,0.04),0_6px_12px_rgba(0,0,0,0.06),0_20px_32px_rgba(0,0,0,0.08)]";

export function LandingAgentsDark() {
  const t = useTranslations("landing.agents");
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeStage, setActiveStage] = useState<Stage>("planning");
  const activeIndex = STAGES.indexOf(activeStage);

  function goToStage(stage: Stage, behavior: ScrollBehavior = "smooth") {
    const rail = railRef.current;
    const slide = rail?.querySelector<HTMLElement>(`#lifecycle-${stage}`);
    if (!rail || !slide) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({ left: slide.offsetLeft, behavior: reduceMotion ? "auto" : behavior });
    setActiveStage(stage);
  }

  function moveBy(offset: number, behavior: ScrollBehavior = "smooth") {
    const nextIndex = Math.min(Math.max(activeIndex + offset, 0), STAGES.length - 1);
    const nextStage = STAGES[nextIndex];
    if (nextStage) goToStage(nextStage, behavior);
  }

  function handleRailScroll() {
    const rail = railRef.current;
    if (!rail || rail.clientWidth === 0) return;

    const nextStage = STAGES[Math.round(rail.scrollLeft / rail.clientWidth)];
    if (nextStage) setActiveStage(nextStage);
  }

  function handleRailKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveBy(1, "auto");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveBy(-1, "auto");
    } else if (event.key === "Home") {
      event.preventDefault();
      goToStage(STAGES[0], "auto");
    } else if (event.key === "End") {
      event.preventDefault();
      const lastStage = STAGES[STAGES.length - 1];
      if (lastStage) goToStage(lastStage, "auto");
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % STAGES.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + STAGES.length) % STAGES.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = STAGES.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextStage = STAGES[nextIndex];
    if (!nextStage) return;
    tabRefs.current[nextIndex]?.focus();
    goToStage(nextStage, "auto");
  }

  return (
    <section
      aria-labelledby="agents-title"
      id="agents"
      className="border-y border-border bg-surface-subtle py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-[1168px] px-4 md:px-6 xl:px-0">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Reveal className="max-w-[860px]">
            <h2
              id="agents-title"
              className="text-balance text-3xl font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl"
            >
              {t("title")}
            </h2>
            <p className="mt-6 max-w-[860px] text-lg leading-relaxed text-muted-foreground">
              {t("lead")}
            </p>
          </Reveal>

          <Reveal delay={100} className="flex items-center gap-3 lg:pb-1">
            <span aria-live="polite" className="mr-1 min-w-12 text-sm font-semibold text-foreground">
              {activeIndex + 1} / {STAGES.length}
            </span>
            <button
              type="button"
              onClick={() => moveBy(-1)}
              disabled={activeIndex === 0}
              aria-label={t("previous")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-canvas text-foreground transition-colors duration-150 ease-out hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => moveBy(1)}
              disabled={activeIndex === STAGES.length - 1}
              aria-label={t("next")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-canvas text-foreground transition-colors duration-150 ease-out hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            >
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <nav
            aria-label={t("railLabel")}
            className="no-scrollbar mt-10 flex overflow-x-auto border-b border-border"
          >
            {STAGES.map((stage, index) => {
              const active = activeStage === stage;
              return (
                <button
                  key={stage}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  tabIndex={active ? 0 : -1}
                  aria-current={active ? "step" : undefined}
                  onClick={() => goToStage(stage)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={cn(
                    "relative min-h-12 shrink-0 px-5 text-sm font-semibold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring motion-reduce:transition-none first:pl-0",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`stages.${stage}.nav`)}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-0 h-0.5 origin-left bg-primary transition-transform duration-200 ease-in-out motion-reduce:transition-none",
                      index === 0 ? "left-0 right-5" : "inset-x-5",
                      active ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </Reveal>

        <Reveal delay={180} className="mt-8">
          <div
            ref={railRef}
            tabIndex={0}
            onScroll={handleRailScroll}
            onKeyDown={handleRailKeyDown}
            aria-label={t("sliderLabel")}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-shell border border-border bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(var(--surface-subtle))]"
          >
            {STAGES.map((stage) => (
              <article
                key={stage}
                id={`lifecycle-${stage}`}
                className="grid w-full shrink-0 snap-start snap-always lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]"
              >
                <div className="flex flex-col justify-center px-7 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#B9380E]">
                    {t(`stages.${stage}.eyebrow`)}
                  </p>
                  <h3 className="text-balance text-2xl font-bold leading-[1.2] tracking-[-0.02em] text-foreground md:text-3xl">
                    {t(`stages.${stage}.title`)}
                  </h3>
                  <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
                    {t(`stages.${stage}.body`)}
                  </p>
                </div>

                <div className="min-w-0 border-t border-border bg-canvas p-4 sm:p-6 lg:border-l lg:border-t-0 lg:p-8">
                  <LifecycleVisual stage={stage} />
                </div>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function LifecycleVisual({ stage }: { stage: Stage }) {
  return (
    <div className={canvasClass}>
      <Image
        src={IMAGES[stage]}
        alt=""
        fill
        sizes="(min-width: 768px) 546px, calc(100vw - 32px)"
        className="object-cover"
      />
      <span aria-hidden className="absolute inset-0 bg-black/[0.03]" />
      {stage === "planning" && <PlanningMock />}
      {stage === "assignment" && <AssignmentMock />}
      {stage === "tracking" && <TrackingMock />}
      {stage === "risk" && <RiskMock />}
      {stage === "reporting" && <ReportingMock />}
    </div>
  );
}

function PlanningMock() {
  const t = useTranslations("landing.agents.mock");
  const tasks = [1, 2, 3, 4, 5] as const;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        className={`${panelClass} flex h-[85%] max-h-[380px] w-[94%] max-w-[500px] flex-col overflow-hidden rounded-card sm:w-[90%]`}
      >
        <div className="z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-subtle px-4 sm:h-14 sm:px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface shadow-xs">
            <BarChart3 aria-hidden className="h-4 w-4 text-foreground" />
          </span>
          <span className="text-sm font-bold text-foreground">{t("ganttTitle")}</span>
        </div>

        <div className="relative flex flex-1 overflow-hidden bg-surface">
          <div className="z-10 flex w-[38%] shrink-0 flex-col border-r border-border bg-surface">
            <div className="flex h-9 items-center border-b border-surface-subtle px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:h-10">
              {t("taskColumn")}
            </div>
            {tasks.map((task) => (
              <div
                key={task}
                className="flex h-9 items-center truncate border-b border-surface-subtle px-4 text-xs font-medium text-foreground sm:h-12"
              >
                {task}. {t(`planningTask${task}`)}
              </div>
            ))}
          </div>

          <div className="relative flex-1 overflow-hidden bg-surface">
            <div className="flex h-9 border-b border-surface-subtle sm:h-10">
              {([1, 2, 3] as const).map((week) => (
                <div
                  key={week}
                  className={`flex flex-1 items-center justify-center text-2xs font-bold uppercase text-muted-foreground ${
                    week < 3 ? "border-r border-surface-subtle" : "bg-brand-soft/60"
                  }`}
                >
                  {t(`week${week}`)}
                </div>
              ))}
            </div>

            <div className="relative h-full w-full">
              <div className="absolute inset-0 flex">
                <span className="flex-1 border-r border-surface-subtle" />
                <span className="flex-1 border-r border-surface-subtle" />
                <span className="flex-1 bg-brand-soft/40" />
              </div>
              <span className="absolute left-[7%] top-[7px] h-5 w-[30%] rounded-full bg-success shadow-xs sm:top-3 sm:h-6" />
              <span className="absolute left-[28%] top-[43px] z-10 flex h-6 w-[55%] items-center rounded-full bg-primary px-3 shadow-xs sm:top-[60px] sm:h-7">
                <span className="truncate text-xs font-bold text-primary-foreground">
                  {t("inProgress")}
                </span>
              </span>
              <span className="absolute left-[52%] top-[79px] h-5 w-[38%] rounded-full border border-border bg-surface-subtle shadow-xs sm:top-[108px] sm:h-6" />
              <span className="absolute left-[40%] top-[115px] h-5 w-[44%] rounded-full border border-border bg-surface-subtle shadow-xs sm:top-[156px] sm:h-6" />
              <span className="absolute left-[64%] top-[151px] h-5 w-[30%] rounded-full border border-border bg-surface-subtle shadow-xs sm:top-[204px] sm:h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentMock() {
  const t = useTranslations("landing.agents.mock");

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        className={`${panelClass} w-[94%] max-w-[460px] overflow-hidden rounded-card sm:w-[90%]`}
      >
        <div className="flex items-center gap-3 border-b border-border bg-surface-subtle px-4 py-3 sm:px-6 sm:py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface">
            <Bot aria-hidden className="h-4 w-4 text-ai" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">{t("assignmentPanelTitle")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("assignmentPanelLead")}</p>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:mb-2">
            {t("taskToAssign")}
          </p>
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4 sm:pb-5">
            <div>
              <h4 className="text-sm font-bold text-foreground">{t("assignmentTask")}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{t("assignmentDeadline")}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-[#B9380E]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
              {t("unassigned")}
            </span>
          </div>

          <p className="mb-2.5 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:mb-3 sm:mt-5">
            {t("bestFit")}
          </p>
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-[#B9380E]">
              MA
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">{t("assignee")}</span>
                <span className="rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-[#087F5B]">
                  {t("match")}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{t("capacity")}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-surface-subtle px-4 py-3 sm:px-6 sm:py-4">
          <span className="flex h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold text-foreground">
            {t("skip")}
          </span>
          <span className="flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-xs">
            {t("assign")}
          </span>
        </div>
      </div>
    </div>
  );
}

function TrackingMock() {
  const t = useTranslations("landing.agents.mock");

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        className={`${panelClass} relative z-20 -ml-4 mb-5 w-[94%] max-w-[440px] rounded-xl p-5 sm:-ml-12 sm:w-[88%] sm:p-6`}
      >
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground">{t("progressTitle")}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{t("sprintStatus")}</p>
          </div>
          <span className="text-4xl font-bold tracking-tight text-foreground">68%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-surface-subtle">
          <div
            className="h-full w-[68%] rounded-full"
            style={{ background: "linear-gradient(90deg, #FF8D6B 0%, #FFD56B 55%, #7BE6A3 100%)" }}
          />
        </div>
      </div>

      <div
        className={`${panelClass} relative z-10 ml-6 w-[90%] max-w-[420px] rounded-xl p-5 sm:ml-12 sm:w-[85%]`}
      >
        <h4 className="mb-5 text-xs font-bold uppercase tracking-widest text-foreground">
          {t("activity")}
        </h4>
        <ul className="space-y-5">
          <li className="flex items-start gap-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-muted-foreground shadow-xs">
              MA
            </span>
            <div>
              <p className="text-xs font-medium leading-[1.45] text-foreground sm:text-sm">
                {t("activity1")}
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-2.5 py-1">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-xs font-bold text-[#087F5B]">{t("completed")}</span>
              </span>
            </div>
          </li>
          <li className="flex items-start gap-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-muted-foreground shadow-xs">
              PL
            </span>
            <p className="text-xs font-medium leading-[1.45] text-foreground sm:text-sm">
              {t("activity2")}
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}

function RiskMock() {
  const t = useTranslations("landing.agents.mock");

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        className={`${panelClass} w-[94%] max-w-[460px] overflow-hidden rounded-card sm:w-[90%]`}
      >
        <div className="flex items-start gap-4 border-b border-warning/20 bg-peach-soft px-5 py-4 sm:px-6 sm:py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface shadow-xs">
            <AlertTriangle aria-hidden className="h-4 w-4 text-warning" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-foreground">{t("riskWarning")}</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {t("riskWarningBody")}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bot aria-hidden className="h-4 w-4 text-ai" />
            <span className="text-xs font-bold uppercase tracking-widest text-ai">
              {t("aiSuggestion")}
            </span>
          </div>
          <p className="mb-5 rounded-lg border border-border bg-surface-subtle p-4 text-xs leading-relaxed text-foreground sm:mb-6 sm:text-sm">
            {t("riskSuggestion")}
          </p>
          <div className="flex items-center gap-3">
            <span className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-xs">
              {t("apply")}
            </span>
            <span className="flex h-11 flex-1 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-foreground">
              {t("dismiss")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportingMock() {
  const t = useTranslations("landing.agents.mock");

  return (
    <div className="absolute inset-0 flex items-end justify-center px-4 pt-10 sm:px-6 sm:pt-14">
      <div
        className={`${panelClass} relative flex h-full max-h-[380px] w-[96%] max-w-[500px] flex-col overflow-hidden rounded-t-[24px] border-b-0 p-5 pb-8 sm:max-h-[340px] sm:w-[94%] sm:p-8 sm:pb-10`}
      >
        <div className="mb-6 flex shrink-0 items-start justify-between sm:mb-7">
          <div>
            <h4 className="mb-1 text-base font-bold text-foreground">{t("reportTitle")}</h4>
            <p className="text-sm text-muted-foreground">{t("generatedBy")}</p>
          </div>
          <span className="mt-1 rounded-full border border-primary/20 bg-brand-soft px-2.5 py-1 text-xs font-bold text-[#B9380E]">
            17:30
          </span>
        </div>

        <div className="flex-1 space-y-5 sm:space-y-6">
          <div>
            <h5 className="mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-foreground">
              <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
              {t("done")}
            </h5>
            <ul className="list-outside list-disc space-y-2 pl-5 text-xs text-foreground marker:text-border-strong sm:space-y-2.5 sm:text-sm">
              <li>{t("done1")}</li>
              <li>{t("done2")}</li>
              <li>{t("done3")}</li>
            </ul>
          </div>

          <div>
            <h5 className="mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-foreground">
              <span aria-hidden className="h-2 w-2 rounded-full bg-destructive" />
              {t("attention")}
            </h5>
            <p className="rounded-lg border border-primary/20 bg-brand-soft/60 p-3 text-xs leading-relaxed text-foreground sm:p-3.5 sm:text-sm">
              {t("reportRisk")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
