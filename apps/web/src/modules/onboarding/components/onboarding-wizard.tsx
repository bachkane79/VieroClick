"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export function OnboardingWizard({ displayName }: { displayName: string }) {
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
    setWsName(m === "personal" ? "Không gian của bạn" : "Nhóm của bạn");
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
      toast.error(res.error ?? "Không tạo được không gian, thử lại nhé");
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
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/25 backdrop-blur">V</span>
          VierocClick
        </div>
        <div className="relative z-10">
          <h1 className="max-w-[12ch] text-4xl font-extrabold leading-tight tracking-tight">
            Từ ý tưởng tới việc-đã-giao trong 5 phút.
          </h1>
          <p className="mt-4 max-w-[34ch] text-lg text-white/90">
            Không gian làm việc có AI lập kế hoạch, giao việc và theo dõi từng phase.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-5 text-sm text-white/90">
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" /> Bảo mật theo workspace
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI lập kế hoạch
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

          {step === "mode" && (
            <StepMode onPick={pickMode} />
          )}
          {step === "template" && (
            <StepTemplate mode={mode} onPick={pickTemplate} onAi={pickAi} onBack={() => setStep("mode")} />
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
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Bạn dùng VierocClick cho việc gì?</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Chọn để chúng tôi dựng đúng không gian. Đổi lại sau lúc nào cũng được.
      </p>
      <div className="mt-7 flex flex-col gap-3">
        <ChoiceCard
          icon={User}
          iconClass="bg-primary"
          title="Cá nhân"
          desc="Lập kế hoạch và theo dõi việc của riêng bạn."
          onClick={() => onPick("personal")}
        />
        <ChoiceCard
          icon={Users}
          iconClass="bg-coral"
          title="Nhóm"
          desc="Làm việc cùng người khác, giao việc và theo dõi tiến độ."
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
      <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-white ${iconClass}`}>
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
  const order = TEMPLATE_ORDER[mode];
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Chọn điểm bắt đầu</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Mỗi mẫu tạo sẵn các phase và việc mẫu để bạn không phải bắt đầu từ trang trắng.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {order.map((id) => (
          <TemplateCard key={id} def={TEMPLATES[id]} onClick={() => onPick(id)} />
        ))}
        <button
          onClick={onAi}
          className="relative col-span-full overflow-hidden rounded-lg border border-transparent bg-gradient-to-br from-lavender-soft to-peach-soft p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          <span className="absolute right-3 top-3 text-[11px] font-bold text-lavender">MỚI</span>
          <span className="mb-2.5 grid h-8 w-8 place-items-center rounded-lg bg-lavender text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="block text-[15px] font-semibold">✨ {AI_TEMPLATE.name}</span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{AI_TEMPLATE.description}</span>
        </button>
      </div>
      <button
        onClick={onBack}
        className="mt-4 flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
      </button>
    </div>
  );
}

function TemplateCard({ def, onClick }: { def: TemplateDef; onClick: () => void }) {
  const Icon = ICONS[def.icon] ?? Plus;
  const first = def.seed[0];
  return (
    <button
      onClick={onClick}
      className="overflow-hidden rounded-lg border border-border bg-card p-3.5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated"
    >
      <span className={`mb-2.5 grid h-8 w-8 place-items-center rounded-lg text-white ${TONE[def.tone] ?? "bg-primary"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="block text-[15px] font-semibold">{def.name}</span>
      <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{def.description}</span>
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
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Tả dự án của bạn</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Một hai câu là đủ. AI sẽ lập kế hoạch (phase + việc) ngay sau khi bạn tạo — bạn duyệt trước khi áp dụng.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="VD: Tôi cần ra mắt website bán hàng trong 6 tuần"
        className="mt-4 w-full rounded-lg border border-input bg-background/50 px-3.5 py-3 text-[15px] leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onNext}
          disabled={!value.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" /> Tiếp tục
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
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
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Đặt tên và bắt đầu</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">Gần xong rồi. Bạn sửa được mọi thứ sau.</p>

      <Field label="Tên không gian làm việc">
        <input
          value={wsName}
          onChange={(e) => onWs(e.target.value)}
          className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </Field>
      <Field label="Tên dự án đầu tiên">
        <input
          value={projName}
          onChange={(e) => onProj(e.target.value)}
          className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </Field>
      {mode === "team" && (
        <Field label="Mời thành viên (tùy chọn)">
          <textarea
            value={invites}
            onChange={(e) => onInvites(e.target.value)}
            rows={2}
            placeholder="Dán email, cách nhau bằng dấu phẩy…"
            className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            Chưa có tài khoản cũng không sao — họ nhận lời mời qua email.
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
          Tạo và bắt đầu
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
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
