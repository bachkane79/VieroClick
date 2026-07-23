"use client";

import { AlertTriangle, Users } from "lucide-react";
import type { TeamMemberMetrics } from "@/modules/member-score/member-score.service";

interface Props {
  members: TeamMemberMetrics[];
}

const SCORE_LABELS: { key: keyof TeamMemberMetrics["scores"]; label: string }[] = [
  { key: "reliability", label: "Reliability" },
  { key: "speed", label: "Speed" },
  { key: "quality", label: "Quality" },
  { key: "communication", label: "Comms" },
  { key: "blockerHandling", label: "Blockers" },
];

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const filled = Math.max(0, Math.min(100, (value / 5) * 100));
  const tone = value <= 0 ? "bg-neutral-300" : value < 3 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${filled}%` }} />
      </span>
      <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums">
        {value > 0 ? value.toFixed(1) : "—"}
      </span>
    </div>
  );
}

export function TeamViewClient({ members }: Props) {
  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
        <Users className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm font-semibold">No project members yet</p>
        <p className="mt-0.5 text-xs">Assign tasks or add members to populate team metrics.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {members.map((m) => {
        const loadPct =
          m.capacityHours > 0 ? Math.min(150, Math.round((m.committedHours / m.capacityHours) * 100)) : 0;
        return (
          <div
            key={m.workspaceMemberId}
            className={`rounded-2xl border bg-card p-5 shadow-sm ${
              m.overloaded ? "border-red-300 ring-1 ring-red-200" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{m.fullName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {m.role.replace(/_/g, " ")} · {m.allocationPercent}% allocation
                </div>
              </div>
              {m.overloaded && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                  <AlertTriangle className="h-3 w-3" /> Overloaded
                </span>
              )}
            </div>

            {/* Workload */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Workload</span>
                <span className="font-semibold tabular-nums">
                  {m.committedHours}h / {m.capacityHours}h · {m.openTasks} open
                </span>
              </div>
              <span className="relative block h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    loadPct > 100 ? "bg-red-500" : loadPct > 80 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, loadPct)}%` }}
                />
              </span>
            </div>

            {/* Delivery */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">On-time</div>
                <div className="text-lg font-bold tabular-nums">{pct(m.onTimeRate)}</div>
              </div>
              <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. accuracy</div>
                <div className="text-lg font-bold tabular-nums">{pct(m.estimateAccuracy)}</div>
              </div>
            </div>

            {/* Scores */}
            <div className="mt-4 space-y-1.5">
              {SCORE_LABELS.map((s) => (
                <ScoreBar key={s.key} label={s.label} value={m.scores[s.key]} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
