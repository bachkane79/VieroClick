"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";
import { toast } from "sonner";
import {
  User,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  House,
  GraduationCap,
  Zap,
  Plus,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { OnboardingTemplate } from "@vieroc/validators";
import { completeOnboardingAction } from "../onboarding.actions";
import { TEMPLATES, AI_TEMPLATE, TEMPLATE_ORDER, type TemplateDef } from "../templates";

const ICONS: Record<string, LucideIcon> = {
  House,
  GraduationCap,
  Zap,
  Plus,
  Users,
  Sparkles,
};

const TONE: Record<string, string> = {
  emerald: "bg-mint",
  sky: "bg-sky",
  amber: "bg-peach",
  rose: "bg-coral",
  violet: "bg-lavender",
};

type Step = "mode" | "template" | "ai" | "name";
type Mode = "personal" | "team";

const RESUME_KEY = "vc-onboarding-state";

export function OnboardingWizard() {
  const t = useTranslations();
  const actionError = useActionError();
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>("personal");
  const [template, setTemplate] = useState<OnboardingTemplate>("blank");
  const [aiPrompt, setAiPrompt] = useState("");
  const [wsName, setWsName] = useState("");
  const [projName, setProjName] = useState("");
  const [invites, setInvites] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Resumable (spec §5.2): restore the wizard exactly where it was closed,
  // then persist every change. Cleared on successful create.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESUME_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.step) setStep(s.step);
        if (s.mode) setMode(s.mode);
        if (s.template) setTemplate(s.template);
        if (typeof s.aiPrompt === "string") setAiPrompt(s.aiPrompt);
        if (typeof s.wsName === "string") setWsName(s.wsName);
        if (typeof s.projName === "string") setProjName(s.projName);
        if (typeof s.invites === "string") setInvites(s.invites);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        RESUME_KEY,
        JSON.stringify({ step, mode, template, aiPrompt, wsName, projName, invites })
      );
    } catch {
      /* ignore */
    }
  }, [hydrated, step, mode, template, aiPrompt, wsName, projName, invites]);

  const stepIndex = step === "mode" ? 0 : step === "name" ? 2 : 1;

  function pickMode(m: Mode) {
    setMode(m);
    setWsName(
      m === "personal"
        ? t("onboarding.defaults.personalWorkspace")
        : t("onboarding.defaults.teamWorkspace")
    );
    setStep("template");
  }

  function pickTemplate(id: keyof typeof TEMPLATES) {
    setTemplate(id);
    setProjName(TEMPLATES[id].projectName);
    setStep("name");
  }

  function pickAi() {
    setTemplate("ai-generated");
    setProjName(AI_TEMPLATE.projectName);
    setStep("ai");
  }

  async function create() {
    if (!wsName.trim() || !projName.trim()) return;
    setSubmitting(true);
    const emails = invites
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    const res = await completeOnboardingAction({
      mode,
      template,
      workspaceName: wsName.trim(),
      projectName: projName.trim(),
      aiPrompt: aiPrompt.trim() || undefined,
      invites: emails,
    });
    if (res.ok) {
      try {
        localStorage.removeItem(RESUME_KEY);
      } catch {
        /* ignore */
      }
      router.push(`/workspace/${res.data.workspaceSlug}`);
    } else {
      toast.error(actionError(res, t("onboarding.toast.createFailed")));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — solid primary (marketing surface, not the app shell) */}
      <div className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-12 bottom-16 h-52 w-52 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3 text-xl font-extrabold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/25 backdrop-blur">
            V
          </span>
          VierocClick
        </div>
        <div className="relative z-10">
          <h1 className="max-w-[12ch] text-4xl font-extrabold leading-tight tracking-tight">
            {t("onboarding.brand.headline")}
          </h1>
          <p className="mt-4 max-w-[34ch] text-lg text-white/90">{t("onboarding.brand.subhead")}</p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-5 text-sm text-white/90">
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" /> {t("onboarding.brand.secure")}
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> {t("onboarding.brand.aiPlanning")}
          </span>
        </div>
      </div>

      {/* Wizard panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[520px]">
          {/* progress dots */}
          <div className="mb-7 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>

          {step === "mode" && <StepMode onPick={pickMode} />}
          {step === "template" && (
            <StepTemplate
              mode={mode}
              onPick={pickTemplate}
              onAi={pickAi}
              onBack={() => setStep("mode")}
            />
          )}
          {step === "ai" && (
            <StepAi
              value={aiPrompt}
              onChange={setAiPrompt}
              onNext={() => setStep("name")}
              onBack={() => setStep("template")}
            />
          )}
          {step === "name" && (
            <StepName
              mode={mode}
              wsName={wsName}
              projName={projName}
              invites={invites}
              submitting={submitting}
              onWs={setWsName}
              onProj={setProjName}
              onInvites={setInvites}
              onCreate={create}
              onBack={() => setStep(template === "ai-generated" ? "ai" : "template")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepMode({ onPick }: { onPick: (m: Mode) => void }) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{t("onboarding.mode.title")}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">{t("onboarding.mode.subtitle")}</p>
      <div className="mt-7 flex flex-col gap-3">
        <ChoiceCard
          icon={User}
          iconClass="bg-primary"
          title={t("onboarding.mode.personal.title")}
          desc={t("onboarding.mode.personal.desc")}
          onClick={() => onPick("personal")}
        />
        <ChoiceCard
          icon={Users}
          iconClass="bg-coral"
          title={t("onboarding.mode.team.title")}
          desc={t("onboarding.mode.team.desc")}
          onClick={() => onPick("team")}
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  icon: Icon,
  iconClass,
  title,
  desc,
  onClick,
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated"
    >
      <span
        className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-white ${iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13.5px] text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 flex-none text-muted-foreground opacity-50 transition group-hover:translate-x-0.5" />
    </button>
  );
}

function StepTemplate({
  mode,
  onPick,
  onAi,
  onBack,
}: {
  mode: Mode;
  onPick: (id: keyof typeof TEMPLATES) => void;
  onAi: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();
  const order = TEMPLATE_ORDER[mode];
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{t("onboarding.template.title")}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">{t("onboarding.template.subtitle")}</p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {order.map((id) => (
          <TemplateCard key={id} def={TEMPLATES[id]} onClick={() => onPick(id)} />
        ))}
        <button
          onClick={onAi}
          className="relative col-span-full overflow-hidden rounded-lg border border-transparent bg-gradient-to-br from-lavender-soft to-peach-soft p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          <span className="absolute right-3 top-3 text-[11px] font-bold text-lavender">
            {t("onboarding.template.newBadge")}
          </span>
          <span className="mb-2.5 grid h-8 w-8 place-items-center rounded-lg bg-lavender text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="block text-[15px] font-semibold">
            ✨ {t(AI_TEMPLATE.nameKey as Parameters<typeof t>[0])}
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            {t(AI_TEMPLATE.descKey as Parameters<typeof t>[0])}
          </span>
        </button>
      </div>
      <button
        onClick={onBack}
        className="mt-4 flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("onboarding.actions.back")}
      </button>
    </div>
  );
}

function TemplateCard({ def, onClick }: { def: TemplateDef; onClick: () => void }) {
  const t = useTranslations();
  const Icon = ICONS[def.icon] ?? Plus;
  const first = def.seed[0];
  return (
    <button
      onClick={onClick}
      className="overflow-hidden rounded-lg border border-border bg-card p-3.5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated"
    >
      <span
        className={`mb-2.5 grid h-8 w-8 place-items-center rounded-lg text-white ${TONE[def.tone] ?? "bg-primary"}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="block text-[15px] font-semibold">
        {t(def.nameKey as Parameters<typeof t>[0])}
      </span>
      <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
        {t(def.descKey as Parameters<typeof t>[0])}
      </span>
      {first && (
        <span className="mt-2.5 block">
          <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {first.phase}
          </span>
          {first.tasks.slice(0, 2).map((tk, i) => (
            <span key={i} className="mt-1 flex items-center gap-1.5 text-[12px] text-foreground/80">
              <span className="h-2.5 w-2.5 flex-none rounded-[3px] border border-muted-foreground/60" />
              {tk.title}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function StepAi({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{t("onboarding.ai.title")}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">{t("onboarding.ai.subtitle")}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={t("onboarding.ai.placeholder")}
        className="mt-4 w-full rounded-lg border border-input bg-background/50 px-3.5 py-3 text-[15px] leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onNext}
          disabled={!value.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" /> {t("onboarding.actions.continue")}
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("onboarding.actions.back")}
        </button>
      </div>
    </div>
  );
}

function StepName({
  mode,
  wsName,
  projName,
  invites,
  submitting,
  onWs,
  onProj,
  onInvites,
  onCreate,
  onBack,
}: {
  mode: Mode;
  wsName: string;
  projName: string;
  invites: string;
  submitting: boolean;
  onWs: (v: string) => void;
  onProj: (v: string) => void;
  onInvites: (v: string) => void;
  onCreate: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{t("onboarding.name.title")}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">{t("onboarding.name.subtitle")}</p>

      <Field label={t("onboarding.name.workspaceLabel")}>
        <input
          value={wsName}
          onChange={(e) => onWs(e.target.value)}
          className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </Field>
      <Field label={t("onboarding.name.projectLabel")}>
        <input
          value={projName}
          onChange={(e) => onProj(e.target.value)}
          className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </Field>
      {mode === "team" && (
        <Field label={t("onboarding.name.invitesLabel")}>
          <textarea
            value={invites}
            onChange={(e) => onInvites(e.target.value)}
            rows={2}
            placeholder={t("onboarding.name.invitesPlaceholder")}
            className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {t("onboarding.name.invitesHint")}
          </p>
        </Field>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={onCreate}
          disabled={submitting || !wsName.trim() || !projName.trim()}
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-[16px] font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("onboarding.actions.createAndStart")}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("onboarding.actions.back")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <label className="mb-1.5 block text-[13px] font-semibold text-foreground/80">{label}</label>
      {children}
    </div>
  );
}
