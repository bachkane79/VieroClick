"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Flag, Loader2, Plus, User } from "lucide-react";
import { cn } from "@vieroc/ui";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import { quickCreateTaskAction } from "../task.actions";

/**
 * One-line natural-language task input (B2C spec §5.6, prototype quick-create).
 * Syntax: plain text = title · `@name` = assignee · `!cao|!thấp|!high|!low` =
 * priority · `hôm nay|mai|t2..t7|dd/mm` = due date. Chips preview the parse
 * before Enter commits, so a wrong guess is visible and editable.
 */

export interface QuickCreateProject {
  id: string;
  name: string;
}

interface Parsed {
  title: string;
  assigneeQuery?: string;
  priority?: "low" | "high";
  due?: Date;
  dueLabel?: string;
}

const DAY_WORDS: Record<string, number> = {
  "hôm nay": 0,
  homnay: 0,
  today: 0,
  "ngày mai": 1,
  mai: 1,
  tomorrow: 1,
};

function parseQuick(raw: string): Parsed {
  let title = raw;
  const out: Parsed = { title: raw };

  const at = raw.match(/@(\p{L}+)/u);
  if (at) {
    out.assigneeQuery = at[1];
    title = title.replace(at[0], "");
  }

  if (/!(cao|high|p1)\b/i.test(raw)) {
    out.priority = "high";
    title = title.replace(/!(cao|high|p1)\b/i, "");
  } else if (/!(thấp|thap|low|p3)\b/i.test(raw)) {
    out.priority = "low";
    title = title.replace(/!(thấp|thap|low|p3)\b/i, "");
  }

  let matched = false;
  for (const [word, offset] of Object.entries(DAY_WORDS)) {
    const re = new RegExp(`(^|\\s)${word}($|\\s)`, "i");
    if (re.test(title)) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      out.due = d;
      title = title.replace(new RegExp(word, "i"), "");
      matched = true;
      break;
    }
  }
  if (!matched) {
    const wd = title.match(/(^|\s)(t[2-7]|thứ [2-7])($|\s)/i);
    if (wd) {
      const map: Record<string, number> = { t2: 1, t3: 2, t4: 3, t5: 4, t6: 5, t7: 6 };
      const key = wd[2]!.toLowerCase().replace("thứ ", "t");
      const target = map[key];
      if (target !== undefined) {
        const now = new Date();
        let add = (target - now.getDay() + 7) % 7;
        if (add === 0) add = 7;
        const d = new Date();
        d.setDate(d.getDate() + add);
        out.due = d;
        title = title.replace(wd[2]!, "");
        matched = true;
      }
    }
  }
  if (!matched) {
    const dm = title.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (dm) {
      const now = new Date();
      const d = new Date(now.getFullYear(), parseInt(dm[2]!) - 1, parseInt(dm[1]!));
      if (d < now) d.setFullYear(now.getFullYear() + 1);
      out.due = d;
      title = title.replace(dm[0], "");
    }
  }

  if (out.due) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dd = new Date(out.due);
    dd.setHours(0, 0, 0, 0);
    const diff = Math.round((dd.getTime() - today.getTime()) / 86400000);
    out.dueLabel =
      diff === 0 ? "Hôm nay" : diff === 1 ? "Ngày mai" : `${dd.getDate()}/${dd.getMonth() + 1}`;
  }

  out.title = title.replace(/\s+/g, " ").trim();
  return out;
}

export function QuickCreate({
  workspaceId,
  slug,
  projects,
}: {
  workspaceId: string;
  slug: string;
  projects: QuickCreateProject[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(() => parseQuick(value), [value]);
  const showChips = value.trim().length > 0 && (parsed.assigneeQuery || parsed.due || parsed.priority);

  if (projects.length === 0) return null;

  async function submit() {
    const p = parseQuick(value);
    const title = p.title || value.trim();
    if (!title || !projectId || submitting) return;
    setSubmitting(true);
    const res = await quickCreateTaskAction({
      workspaceId,
      projectId,
      slug,
      title,
      dueDate: p.due ? p.due.toISOString().slice(0, 10) : undefined,
      priority: p.priority,
      assigneeQuery: p.assigneeQuery,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success(
        res.data.assigneeName
          ? t(locale, "qc.createdFor", { who: res.data.assigneeName })
          : t(locale, "qc.created")
      );
      setValue("");
      router.refresh();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      toast.error(res.error ?? t(locale, "qc.failed"));
    }
  }

  return (
    <div className="border-b bg-secondary/50">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        {submitting ? (
          <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary" />
        ) : (
          <Plus className="h-[18px] w-[18px] shrink-0 text-primary" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={submitting}
          placeholder={t(locale, "qc.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {projects.length > 1 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-7 max-w-[160px] shrink-0 rounded-md border bg-card px-1.5 text-xs text-muted-foreground outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {showChips && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2.5">
          {parsed.assigneeQuery && (
            <Chip className="bg-sky-soft text-sky">
              <User className="h-3 w-3" />
              {parsed.assigneeQuery}
            </Chip>
          )}
          {parsed.dueLabel && (
            <Chip className="bg-peach-soft text-peach">
              <CalendarClock className="h-3 w-3" />
              {parsed.dueLabel}
            </Chip>
          )}
          {parsed.priority === "high" && (
            <Chip className="bg-coral-soft text-coral">
              <Flag className="h-3 w-3" />
              {t(locale, "qc.prio.high")}
            </Chip>
          )}
          {parsed.priority === "low" && (
            <Chip className="bg-sky-soft text-sky">
              <Flag className="h-3 w-3" />
              {t(locale, "qc.prio.low")}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}
