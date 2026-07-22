"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages, Monitor } from "lucide-react";
import { cn } from "@vieroc/ui";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/client";
import { setLocaleAction } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/dict";

const LANGS: { value: Locale; label: string; sub: string }[] = [
  { value: "vi", label: "Tiếng Việt", sub: "Vietnamese" },
  { value: "en", label: "English", sub: "Tiếng Anh" },
];

export function Preferences() {
  const router = useRouter();
  const current = useLocale();
  const [selected, setSelected] = useState<Locale>(current);
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === selected) return;
    setSelected(next);
    startTransition(async () => {
      const res = await setLocaleAction(next);
      if (res.ok) {
        toast.success(next === "vi" ? "Đã đổi sang Tiếng Việt" : "Switched to English");
        router.refresh();
      }
    });
  }

  const t = (vi: string, en: string) => (current === "vi" ? vi : en);

  return (
    <div className="space-y-6">
      {/* Language */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <header className="mb-4 flex items-start gap-2">
          <Languages className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("Ngôn ngữ", "Language")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("Ngôn ngữ hiển thị của giao diện.", "The display language of the interface.")}
            </p>
          </div>
        </header>
        <div className="grid gap-2 sm:grid-cols-2">
          {LANGS.map((l) => {
            const active = selected === l.value;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => choose(l.value)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface-hover"
                )}
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">{l.label}</span>
                  <span className="block text-xs text-muted-foreground">{l.sub}</span>
                </span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <header className="mb-3 flex items-start gap-2">
          <Monitor className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("Giao diện", "Appearance")}</h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "Hiện đang theo giao diện hệ thống. Tùy chọn sáng/tối riêng sẽ bổ sung sau.",
                "Currently follows your system theme. A dedicated light/dark toggle is coming."
              )}
            </p>
          </div>
        </header>
        <span className="inline-flex rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {t("Theo hệ thống", "System")}
        </span>
      </section>
    </div>
  );
}
