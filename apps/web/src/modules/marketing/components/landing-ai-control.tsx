"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Folder,
  History,
  LayoutTemplate,
  RotateCcw,
  Sparkles,
  Type,
  User,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@vieroc/ui";
import { Container, Reveal } from "./landing-ui";
import styles from "./landing-ai-control.module.css";

type AiMode = "review" | "auto";
type Decision = "approved" | "rejected";

const panelClass =
  "relative flex h-[620px] min-w-0 flex-col overflow-hidden rounded-[32px] border border-border/70";
const mockShadow =
  "shadow-[0_1px_1px_rgba(0,0,0,0.04),0_6px_12px_rgba(0,0,0,0.06),0_20px_32px_rgba(0,0,0,0.08)]";

export function LandingAiControl() {
  const t = useTranslations("landing.aiControl");
  const sectionRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<AiMode>("review");
  const [modePinned, setModePinned] = useState(false);
  const [motionActive, setMotionActive] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => setMotionActive(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!motionActive || modePinned) return;
    const interval = window.setInterval(
      () => setMode((current) => (current === "review" ? "auto" : "review")),
      3200
    );
    return () => window.clearInterval(interval);
  }, [modePinned, motionActive]);

  const history = [
    {
      key: "dateChange",
      icon: CalendarDays,
      decision: "approved" as const,
      title: t("history.items.dateChange.title"),
      time: t("history.items.dateChange.time"),
    },
    {
      key: "titleChange",
      icon: Type,
      decision: "rejected" as const,
      title: t("history.items.titleChange.title"),
      time: t("history.items.titleChange.time"),
    },
    {
      key: "contentAssignment",
      icon: UserRoundPlus,
      decision: "approved" as const,
      title: t("history.items.contentAssignment.title"),
      time: t("history.items.contentAssignment.time"),
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="ai-control"
      aria-labelledby="ai-control-title"
      className="bg-canvas py-20 md:py-28"
    >
      <Container className="max-w-[1168px]">
        <Reveal className="mx-auto mb-14 max-w-2xl px-4 text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h2
            id="ai-control-title"
            className="text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-4xl lg:text-5xl"
          >
            {t("title")}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("intro")}
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <article className={cn(panelClass, "bg-brand-soft")} aria-labelledby="ai-mode-title">
              <PanelHeading
                label={t("mode.label")}
                title={t("mode.title")}
                titleId="ai-mode-title"
                action={t("mode.action")}
                tone="orange"
              />

              <div className="absolute -bottom-8 left-6 flex h-[65%] w-[112%] items-end sm:w-[110%]">
                <div
                  className={cn(
                    mockShadow,
                    "flex h-full w-full flex-col overflow-hidden rounded-t-[24px] border border-border bg-surface",
                    motionActive && styles.surfaceEnter
                  )}
                >
                  <div className="flex items-center gap-3 border-b border-border py-5 pl-6 pr-20 sm:pl-8">
                    <Folder aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {t("mode.project")}
                    </span>
                  </div>
                  <div className="flex-1 bg-surface-subtle/50 py-6 pl-6 pr-20 sm:pl-8">
                    <p className="mb-5 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {t("mode.setting")}
                    </p>
                    <div role="radiogroup" aria-label={t("mode.setting")} className="space-y-5">
                      <ModeOption
                        checked={mode === "review"}
                        title={t("mode.reviewRequired")}
                        body={t("mode.reviewHint")}
                        onClick={() => {
                          setMode("review");
                          setModePinned(true);
                        }}
                      />
                      <ModeOption
                        checked={mode === "auto"}
                        title={t("mode.fullAuto")}
                        body={t("mode.autoHint")}
                        onClick={() => {
                          setMode("auto");
                          setModePinned(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article
              className={cn(panelClass, "bg-lavender-soft")}
              aria-labelledby="ai-review-title"
            >
              <PanelHeading
                label={t("review.label")}
                title={t("review.title")}
                titleId="ai-review-title"
                action={t("review.action")}
                tone="violet"
              />

              <div className="absolute inset-0 top-[35%] flex w-full flex-col items-center">
                <span
                  aria-hidden
                  className="absolute inset-[-20px] bg-[linear-gradient(to_right,rgba(0,0,0,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.025)_1px,transparent_1px)] bg-[length:20px_20px] opacity-60"
                />
                <div
                  aria-hidden
                  className="absolute inset-x-[-15%] top-10 flex w-[130%] flex-col gap-2.5 px-4"
                >
                  <span className="h-8 w-[95%] rounded-md bg-rose-100/70 px-3 py-3">
                    <span className="block h-2 w-3/4 rounded bg-rose-200/80" />
                  </span>
                  <span className="h-8 w-[105%] rounded-md bg-emerald-100/70 px-3 py-3">
                    <span className="block h-2 w-2/3 rounded bg-emerald-200/80" />
                  </span>
                  <span className="mt-5 h-8 w-full rounded-md border border-white/20 bg-white/55 px-3 py-3">
                    <span className="block h-2 w-1/2 rounded bg-black/5" />
                  </span>
                  <span className="h-8 w-[85%] rounded-md border border-white/20 bg-white/55 px-3 py-3">
                    <span className="block h-2 w-3/4 rounded bg-black/5" />
                  </span>
                </div>

                <div
                  className={cn(
                    "absolute inset-x-6 -bottom-1 flex justify-center",
                    motionActive && styles.proposalEnter
                  )}
                >
                  {decision ? (
                    <div
                      aria-live="polite"
                      className={cn(
                        mockShadow,
                        "relative z-20 flex min-h-[308px] w-full flex-col items-center justify-center rounded-t-[24px] border border-border bg-surface px-6 pb-14 pt-6 text-center"
                      )}
                    >
                      <span
                        className={cn(
                          "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                          decision === "approved"
                            ? "bg-mint-soft text-success"
                            : "bg-rose-50 text-destructive"
                        )}
                      >
                        {decision === "approved" ? (
                          <Check aria-hidden className="h-5 w-5" />
                        ) : (
                          <X aria-hidden className="h-5 w-5" />
                        )}
                      </span>
                      <p className="text-sm font-semibold text-foreground">
                        {decision === "approved" ? t("review.approved") : t("review.rejected")}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDecision(null)}
                        className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                        {t("review.reset")}
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        mockShadow,
                        "relative z-10 w-full rounded-t-[24px] border border-border bg-surface px-5 pb-12 pt-5 sm:px-6 sm:pb-14 sm:pt-6"
                      )}
                    >
                      <div className="mb-4 flex items-center gap-2 text-ai">
                        <Sparkles aria-hidden className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-[0.08em]">
                          {t("review.suggestionLabel")}
                        </span>
                      </div>
                      <h3 className="mb-2 text-base font-semibold tracking-tight text-foreground">
                        {t("review.suggestionTitle")}
                      </h3>
                      <span className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-surface-subtle px-2.5 py-1 text-xs text-muted-foreground">
                        <User aria-hidden className="h-3.5 w-3.5" />
                        {t("review.assignee")}
                      </span>
                      <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                          <span>{t("review.confidenceLabel")}</span>
                          <span>{t("review.confidenceValue")}</span>
                        </div>
                        <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                          <span
                            aria-hidden
                            className="absolute inset-y-[-2px] left-[75%] z-10 w-px bg-foreground/30"
                          />
                          <span
                            aria-hidden
                            className={cn(
                              "block h-full w-[72%] origin-left rounded-full bg-ai",
                              motionActive && styles.confidenceFill
                            )}
                          />
                        </div>
                        <p className="mt-2 text-2xs text-muted-foreground">
                          {t("review.threshold")}
                        </p>
                      </div>
                      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                        {t("review.reason")}
                      </p>
                      <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 md:flex md:justify-end">
                        <button
                          type="button"
                          onClick={() => setDecision("rejected")}
                          className="flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          {t("review.reject")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecision("approved")}
                          className="flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          {t("review.apply")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>

            <article className={cn(panelClass, "bg-sky-soft")} aria-labelledby="ai-history-title">
              <PanelHeading
                label={t("history.label")}
                title={t("history.title")}
                titleId="ai-history-title"
                action={t("history.action")}
                tone="sky"
              />

              <div className="absolute -bottom-8 right-6 flex h-[65%] w-[112%] items-end sm:w-[110%]">
                <div
                  className={cn(
                    mockShadow,
                    "flex h-full w-full flex-col overflow-hidden rounded-t-[24px] border border-border bg-surface",
                    motionActive && styles.surfaceEnter,
                    motionActive && styles.surfaceEnterLate
                  )}
                >
                  <div className="z-10 flex items-center gap-3 border-b border-border bg-surface py-5 pl-20 pr-6 sm:pr-8">
                    <History aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {t("history.panelTitle")}
                    </span>
                    <span className="ml-auto shrink-0 rounded-full bg-surface-subtle px-2 py-1 text-2xs font-semibold text-muted-foreground">
                      {t("history.count", { count: history.length + (decision ? 1 : 0) })}
                    </span>
                  </div>
                  <div className="relative flex-1 overflow-hidden bg-surface-subtle/40 py-5 pl-20 pr-6 sm:pr-8">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-surface-subtle via-surface-subtle/90 to-transparent"
                    />
                    <div className="space-y-2.5">
                      {decision && (
                        <HistoryRow
                          icon={LayoutTemplate}
                          title={t("history.current.title")}
                          status={
                            decision === "approved"
                              ? t("history.status.approved")
                              : t("history.status.rejected")
                          }
                          time={t("history.current.time")}
                          decision={decision}
                          motionActive={motionActive}
                          animationIndex={0}
                        />
                      )}
                      {history.map((item, index) => (
                        <HistoryRow
                          key={item.key}
                          icon={item.icon}
                          title={item.title}
                          status={
                            item.decision === "approved"
                              ? t("history.status.approved")
                              : t("history.status.rejected")
                          }
                          time={item.time}
                          decision={item.decision}
                          motionActive={motionActive}
                          animationIndex={index + (decision ? 1 : 0)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function PanelHeading({
  label,
  title,
  titleId,
  action,
  tone,
}: {
  label: string;
  title: string;
  titleId: string;
  action: string;
  tone: "orange" | "violet" | "sky";
}) {
  return (
    <div className="z-20 flex flex-col items-center px-6 pt-10 text-center">
      <span
        className={cn(
          "mb-3 text-sm",
          tone === "orange" && "text-primary",
          tone === "violet" && "text-ai",
          tone === "sky" && "text-sky"
        )}
      >
        {label}
      </span>
      <h3
        id={titleId}
        className="mb-6 px-4 text-2xl font-semibold leading-[1.2] tracking-tight text-foreground"
      >
        {title}
      </h3>
      <span className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-black/15 px-5 text-sm font-medium text-foreground shadow-xs md:min-h-9">
        {action}
      </span>
    </div>
  );
}

function ModeOption({
  checked,
  title,
  body,
  onClick,
}: {
  checked: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] w-full items-start gap-4 rounded-xl text-left transition-[opacity,transform] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none",
        checked ? "translate-x-1 opacity-100" : "translate-x-0 opacity-55 hover:opacity-80"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-surface transition-colors duration-300 ease-in-out motion-reduce:transition-none",
          checked ? "border-ai" : "border-border"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full bg-ai transition-[opacity,transform] duration-300 ease-in-out motion-reduce:transition-none",
            checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
        />
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

function HistoryRow({
  icon: Icon,
  title,
  status,
  time,
  decision,
  motionActive,
  animationIndex,
}: {
  icon: typeof CalendarDays;
  title: string;
  status: string;
  time: string;
  decision: Decision;
  motionActive: boolean;
  animationIndex: number;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 rounded-xl border border-border/60 bg-surface p-3 shadow-xs",
        motionActive && styles.activityRow
      )}
      style={{ "--activity-index": animationIndex } as CSSProperties}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-muted-foreground">
          <Icon aria-hidden className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
      </div>
      <div className="ml-[34px] flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              decision === "approved" ? "bg-success" : "bg-destructive"
            )}
          />
          {status}
        </span>
        <span className="text-disabled shrink-0 text-xs">{time}</span>
      </div>
    </div>
  );
}
