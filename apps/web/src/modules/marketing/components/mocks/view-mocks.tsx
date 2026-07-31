import { useTranslations } from "next-intl";
import { Bot, CalendarDays, CircleAlert, CircleCheck, Eye, Send } from "lucide-react";
import { cn } from "@vieroc/ui";
import { statusColor } from "@/modules/task/status-colors";
import type { TaskStatusView } from "@/modules/task/task.view";
import { AvatarStack, IconPlate, ProgressBar } from "./app-chrome";

/**
 * Static reproductions of the five project views, used as landing-page
 * imagery. They read status colour from `status-colors.ts` rather than
 * hard-coding hexes, so a change to the product palette carries through here
 * and the marketing page can never drift from the app it is selling.
 */

type StatusType = TaskStatusView["type"];

function StatusPill({ type, label }: { type: StatusType; label: string }) {
  const c = statusColor(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold",
        c.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {label}
    </span>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-2xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold text-foreground", tone)}>{value}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- overview */

export function OverviewMock() {
  const t = useTranslations("landing.mock");

  const phases = [
    { label: t("phaseResearch"), value: 100 },
    { label: t("phaseDesign"), value: 82 },
    { label: t("phaseBuild"), value: 48 },
    { label: t("phaseTest"), value: 12 },
  ];

  const activity = [
    { i: "MA", actor: t("activity1Actor"), action: t("activity1Action"), object: t("activity1Object"), time: t("activity1Time") },
    { i: "AI", actor: t("activity2Actor"), action: t("activity2Action"), object: t("activity2Object"), time: t("activity2Time") },
    { i: "TA", actor: t("activity3Actor"), action: t("activity3Action"), object: t("activity3Object"), time: t("activity3Time") },
    { i: "PL", actor: t("activity4Actor"), action: t("activity4Action"), object: t("activity4Object"), time: t("activity4Time") },
  ];

  return (
    <div className="min-w-0 space-y-4 bg-surface-subtle/40 p-5">
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label={t("done")} value="45" />
        <MetricTile label={t("inProgress")} value="12" tone="text-primary" />
        <MetricTile label={t("overdue")} value="3" tone="text-destructive" />
        <MetricTile label={t("aiProductivity")} value="+24%" tone="text-lavender" />
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-card border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">{t("phaseProgress")}</p>
          <ul className="space-y-3">
            {phases.map((p) => (
              <li key={p.label}>
                <div className="mb-1.5 flex items-center justify-between text-2xs">
                  <span className="font-medium text-foreground">{p.label}</span>
                  <span className="text-muted-foreground">{p.value}%</span>
                </div>
                <ProgressBar value={p.value} />
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-card border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">{t("recentActivity")}</p>
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.object} className="flex items-start gap-2.5">
                <AvatarStack names={[a.i]} />
                <span className="min-w-0 text-2xs leading-relaxed">
                  <span className="font-semibold text-foreground">{a.actor}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>{" "}
                  <span className="font-medium text-foreground">{a.object}</span>
                  <span className="block text-muted-foreground">{a.time}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- list */

export function ListMock() {
  const t = useTranslations("landing.mock");

  const rows: { title: string; who: string[]; type: StatusType; label: string; due: string; late?: boolean; done?: boolean }[] = [
    { title: t("task1"), who: ["MA", "TA"], type: "in_progress", label: t("statusInProgress"), due: t("due1") },
    { title: t("task2"), who: ["PL"], type: "done", label: t("statusDone"), due: t("due2"), done: true },
    { title: t("task3"), who: ["AI", "HN"], type: "todo", label: t("statusTodo"), due: t("due3") },
    { title: t("task4"), who: ["TA", "PL", "MA"], type: "blocked", label: t("statusBlocked"), due: t("due4"), late: true },
    { title: t("task5"), who: ["HN"], type: "in_review", label: t("statusInReview"), due: t("due5") },
  ];

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-surface-subtle">
            <th className="px-5 py-3 text-2xs font-bold uppercase tracking-wide text-muted-foreground">{t("colTask")}</th>
            <th className="px-5 py-3 text-2xs font-bold uppercase tracking-wide text-muted-foreground">{t("colAssignee")}</th>
            <th className="px-5 py-3 text-2xs font-bold uppercase tracking-wide text-muted-foreground">{t("colStatus")}</th>
            <th className="px-5 py-3 text-right text-2xs font-bold uppercase tracking-wide text-muted-foreground">{t("colDue")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.title} className="border-b border-border last:border-0">
              <td className="px-5 py-3">
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      r.done ? "border-success bg-success text-white" : "border-border-strong"
                    )}
                  >
                    {r.done ? <CircleCheck className="h-3 w-3" /> : null}
                  </span>
                  <span className={cn("text-xs font-medium", r.done ? "text-muted-foreground line-through" : "text-foreground")}>
                    {r.title}
                  </span>
                </span>
              </td>
              <td className="px-5 py-3">
                <AvatarStack names={r.who} />
              </td>
              <td className="px-5 py-3">
                <StatusPill type={r.type} label={r.label} />
              </td>
              <td className="px-5 py-3 text-right">
                <span
                  className={cn(
                    "inline-block rounded-full border px-2.5 py-1 text-2xs font-medium",
                    r.late ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground"
                  )}
                >
                  {r.due}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ board */

export function BoardMock() {
  const t = useTranslations("landing.mock");

  const columns: { type: StatusType; label: string; count: number; cards: { tag: string; title: string; who: string; due?: string; review?: boolean; done?: boolean }[] }[] = [
    {
      type: "todo",
      label: t("statusTodo"),
      count: 4,
      cards: [
        { tag: t("tagMarketing"), title: t("board1"), who: "MA", due: t("due3") },
        { tag: t("tagDesign"), title: t("board2"), who: "AI" },
      ],
    },
    {
      type: "in_progress",
      label: t("statusInProgress"),
      count: 3,
      cards: [
        { tag: t("tagDevelopment"), title: t("board3"), who: "TA", due: t("today") },
        { tag: t("tagContent"), title: t("board4"), who: "PL", due: t("tomorrow") },
      ],
    },
    {
      type: "in_review",
      label: t("statusInReview"),
      count: 2,
      cards: [{ tag: t("tagMarketing"), title: t("board5"), who: "HN", review: true }],
    },
    {
      type: "done",
      label: t("statusDone"),
      count: 6,
      cards: [
        { tag: t("tagMarketing"), title: t("board6"), who: "MA", due: t("yesterday"), done: true },
        { tag: t("tagDevelopment"), title: t("board7"), who: "TA", done: true },
      ],
    },
  ];

  return (
    <div className="min-w-0 overflow-x-auto bg-surface-subtle/40 p-5">
      <div className="flex min-w-[720px] gap-3">
        {columns.map((col) => {
          const c = statusColor(col.type);
          return (
            <div key={col.label} className="min-w-0 flex-1 rounded-card bg-surface-subtle p-2.5">
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                <span className="text-xs font-semibold text-foreground">{col.label}</span>
                <span className="ml-auto text-2xs text-muted-foreground">{col.count}</span>
              </div>
              <div className="space-y-2">
                {col.cards.map((card) => (
                  <div
                    key={card.title}
                    className={cn(
                      "rounded-xl border border-border bg-surface p-3",
                      card.done && "opacity-60"
                    )}
                  >
                    <p className={cn("text-2xs font-bold uppercase tracking-wide", card.done ? "text-muted-foreground" : "text-primary")}>
                      {card.tag}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-2xs font-medium leading-snug",
                        card.done ? "text-muted-foreground line-through" : "text-foreground"
                      )}
                    >
                      {card.title}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <AvatarStack names={[card.who]} />
                      {card.review ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-medium text-lavender">
                          <Eye className="h-3 w-3" />
                          {t("needsReview")}
                        </span>
                      ) : card.due ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">
                          {card.due}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- calendar */

export function CalendarMock() {
  const t = useTranslations("landing.mock");

  const weekdays = [
    t("weekdayMon"), t("weekdayTue"), t("weekdayWed"),
    t("weekdayThu"), t("weekdayFri"), t("weekdaySat"), t("weekdaySun"),
  ];

  // 5 weeks starting Mon 29 Jun; day 14 is "today".
  const events: Record<number, { label: string; tone: string }> = {
    2: { label: t("event1"), tone: "bg-sky-soft text-sky" },
    7: { label: t("event2"), tone: "bg-mint-soft text-mint" },
    11: { label: t("event3"), tone: "bg-lavender-soft text-lavender" },
    14: { label: t("event4"), tone: "bg-brand-soft text-primary" },
    20: { label: t("event5"), tone: "bg-peach-soft text-peach" },
    27: { label: t("event6"), tone: "bg-sky-soft text-sky" },
  };

  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - 1; // grid starts on Mon 29 Jun → day 1 lands on index 2
    return { key: i, day, outside: day < 1 || day > 31, weekend: i % 7 >= 5 };
  });

  return (
    <div className="min-w-0 p-5">
      <p className="mb-3 text-sm font-semibold text-foreground">{t("calendarMonth")}</p>
      <div className="min-w-0 overflow-x-auto">
        <div className="min-w-[560px] overflow-hidden rounded-card border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-surface-subtle">
            {weekdays.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((c) => {
              const ev = c.outside ? undefined : events[c.day];
              const isToday = c.day === 14;
              return (
                <div
                  key={c.key}
                  className={cn(
                    "relative min-h-[68px] border-b border-r border-border p-1.5 last:border-r-0",
                    c.weekend ? "bg-surface-subtle" : "bg-surface",
                    isToday && "ring-2 ring-inset ring-primary"
                  )}
                >
                  <span className={cn("text-2xs font-medium", c.outside ? "text-text-disabled" : "text-foreground")}>
                    {c.outside ? "" : c.day}
                  </span>
                  {ev ? (
                    <span className={cn("mt-1 block truncate rounded px-1.5 py-0.5 text-2xs font-medium", ev.tone)}>
                      {ev.label}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- report */

export function ReportMock() {
  const t = useTranslations("landing.mock");

  const lines = [
    { Icon: CircleCheck, tone: "mint" as const, label: t("reportDoneLabel"), body: t("reportDoneBody") },
    { Icon: CircleAlert, tone: "peach" as const, label: t("reportBlockedLabel"), body: t("reportBlockedBody") },
    { Icon: CalendarDays, tone: "brand" as const, label: t("reportNextLabel"), body: t("reportNextBody") },
  ];

  return (
    <div className="min-w-0 bg-surface-subtle/40 p-5">
      <div className="mx-auto max-w-[560px] overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <IconPlate tone="brand">
            <Bot className="h-5 w-5" />
          </IconPlate>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{t("reportTitle")}</p>
            <p className="text-2xs text-muted-foreground">{t("reportSubtitle")}</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-2xs font-bold text-primary">
            {t("reportBadge")}
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-2xs">
              <span className="font-medium text-foreground">{t("reportSprint")}</span>
              <span className="font-semibold text-foreground">76%</span>
            </div>
            <ProgressBar value={76} />
          </div>

          <ul className="space-y-3">
            {lines.map(({ Icon, tone, label, body }) => (
              <li key={label} className="flex gap-2.5">
                <IconPlate tone={tone} className="h-6 w-6 rounded-lg">
                  <Icon className="h-3.5 w-3.5" />
                </IconPlate>
                <span className="min-w-0">
                  <span className="block text-2xs font-bold text-foreground">{label}</span>
                  <span className="block text-2xs leading-relaxed text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
            <Send className="h-3 w-3 shrink-0" />
            <span className="truncate">{t("reportSent")}</span>
          </span>
          <span className="shrink-0 text-2xs text-muted-foreground">{t("reportSentAt")}</span>
        </div>
      </div>
    </div>
  );
}
