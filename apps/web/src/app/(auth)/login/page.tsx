import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/server/auth";
import { devBypassEnabled } from "@/server/auth/config";
import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Soft decorative orange glow — the single splash of colour */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-[300px] w-[300px] rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-2">
            <Image
              src="/logo_transparent.png"
              alt="VieroClick"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
            <span className="text-2xl font-bold tracking-tight">
              Viero<span className="text-primary">Click</span>
            </span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
            Your AI virtual project manager
          </p>
        </div>
        <LoginForm showDevBypass={devBypassEnabled} />
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms &amp; Privacy Policy.
        </p>
      </div>
    </div>
  );
}
