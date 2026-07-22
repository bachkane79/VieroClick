"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

interface Props {
  /**
   * Show the email sign-in / sign-up form. It creates a real account in the DB
   * (passwordless), so it is gated off in production unless ALLOW_DEV_BYPASS.
   */
  showDevBypass?: boolean;
}

export function LoginForm({ showDevBypass = false }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleOAuthSignIn = async (provider: string) => {
    setLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch (err) {
      setLoading(null);
    }
  };

  const handleDevSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading("credentials");
    try {
      await signIn("credentials", {
        email,
        name: name || email.split("@")[0] || "Developer",
        callbackUrl: "/dashboard",
      });
    } catch (err) {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* OAuth Buttons */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft space-y-3">
        <button
          onClick={() => handleOAuthSignIn("github")}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-card hover:bg-accent px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading === "github" ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Redirecting...
            </span>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              Continue with GitHub
            </>
          )}
        </button>
        <button
          onClick={() => handleOAuthSignIn("google")}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-card hover:bg-accent px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading === "google" ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Redirecting...
            </span>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>
      </div>

      {showDevBypass && (
        <>
      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-input"></div>
        </div>
        <span className="relative px-3 text-xs uppercase tracking-wider text-muted-foreground bg-background">
          hoặc đăng nhập bằng email
        </span>
      </div>

      {/* Developer Sign In */}
      <form onSubmit={handleDevSignIn} className="rounded-xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="developer@viero.click"
            disabled={!!loading}
            className="w-full px-3.5 py-2.5 rounded-md border border-input bg-card placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Display Name (Optional)
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            disabled={!!loading}
            className="w-full px-3.5 py-2.5 rounded-md border border-input bg-card placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary transition-all text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={!email || !!loading}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold shadow-soft transition-all duration-150 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading === "credentials" ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Đang đăng nhập...
            </span>
          ) : (
            "Đăng nhập / Tạo tài khoản"
          )}
        </button>
      </form>
        </>
      )}
    </div>
  );
}
