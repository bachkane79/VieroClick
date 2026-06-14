import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">VieroClick</h1>
          <p className="text-muted-foreground mt-1">AI-powered project management</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
