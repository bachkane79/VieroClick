"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setLoading(provider);
    await signIn(provider, { callbackUrl: "/dashboard" });
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm space-y-3">
      <button
        onClick={() => handleSignIn("github")}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
      >
        {loading === "github" ? "Redirecting..." : "Continue with GitHub"}
      </button>
      <button
        onClick={() => handleSignIn("google")}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
      >
        {loading === "google" ? "Redirecting..." : "Continue with Google"}
      </button>
    </div>
  );
}
