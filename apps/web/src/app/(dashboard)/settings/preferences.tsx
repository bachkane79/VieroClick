"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages, Monitor } from "lucide-react";
import { cn } from "@vieroc/ui";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { setLocaleAction } from "@/i18n/actions";
import type { Locale } from "@/i18n/locale";

export function Preferences() {
  const router = useRouter();
  const current = useLocale();
  const t = useTranslations();
  const [selected, setSelected] = useState<Locale>(current);
  const [pending, startTransition] = useTransition();

  const LANGS: { value: Locale; label: string; sub: string }[] = [
    { value: "vi", label: t("settings.language.nameVi"), sub: t("settings.language.subVi") },
    { value: "en", label: t("settings.language.nameEn"), sub: t("settings.language.subEn") },
  ];

  function choose(next: Locale) {
    if (next === selected) return;
    setSelected(next);
    startTransition(async () => {
      const res = await setLocaleAction(next);
      if (res.ok) {
        toast.success(
          next === "vi" ? t("settings.language.switchedVi") : t("settings.language.switchedEn")
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Language */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <header className="mb-4 flex items-start gap-2">
          <Languages className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("settings.language.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("settings.language.desc")}</p>
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
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-surface-hover"
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
            <h2 className="text-lg font-semibold tracking-tight">
              {t("settings.appearance.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("settings.appearance.desc")}</p>
          </div>
        </header>
        <span className="inline-flex rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {t("settings.appearance.system")}
        </span>
      </section>
    </div>
  );
}
