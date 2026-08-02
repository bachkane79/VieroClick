"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { registerAction } from "../auth.actions";
import { useActionError } from "@/i18n/use-action-error";

/**
 * Create account (email + password). On success we send the user to /login with
 * a ?registered=1 flag so they sign in explicitly — registration never
 * auto-authenticates. Onboarding then runs as usual on first sign-in.
 */
export function RegisterForm() {
  const t = useTranslations();
  const router = useRouter();
  const actionError = useActionError();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) return;
    setLoading(true);
    setError(null);
    const res = await registerAction({ fullName, email, password });
    if (!res.ok) {
      setError(actionError(res, t("auth.registerFailed")));
      setLoading(false);
      return;
    }
    router.push("/login?registered=1");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-soft"
    >
      <div className="space-y-1">
        <label
          htmlFor="fullName"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("auth.fullNameLabel")}
        </label>
        <input
          id="fullName"
          type="text"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nguyễn Văn A"
          disabled={loading}
          className="w-full rounded-full border border-input bg-card px-4 py-2.5 text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="email"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("common.email")}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@viero.click"
          disabled={loading}
          className="w-full rounded-full border border-input bg-card px-4 py-2.5 text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("auth.passwordLabel")}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          className="w-full rounded-full border border-input bg-card px-4 py-2.5 text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
        />
        <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!fullName || !email || !password || loading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-150 hover:bg-primary-hover active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            {t("auth.creatingAccount")}
          </span>
        ) : (
          t("auth.createAccount")
        )}
      </button>

      <p className="pt-1 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </form>
  );
}
