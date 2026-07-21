import { redirect } from "next/navigation";
import Image from "next/image";
import { Check, Globe, Sparkles } from "lucide-react";
import { auth } from "@/server/auth";
import { devBypassEnabled } from "@/server/auth/config";
import { LoginForm } from "@/modules/auth/components/login-form";

/**
 * Sign-in (B2C spec §5.1): brand-gradient panel on the left (desktop only),
 * form on the right. First screen of the 5-minute journey.
 */
export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — solid primary (login is a marketing surface, not the
          application shell; a single flat brand fill keeps white text legible). */}
      <div className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-12 bottom-16 h-52 w-52 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
          <Image
            src="/logo_transparent.png"
            alt="VieroClick"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg bg-white/25 object-contain p-1 backdrop-blur"
            priority
          />
          VierocClick
        </div>
        <div className="relative z-10">
          <h1 className="max-w-[12ch] text-4xl font-extrabold leading-tight tracking-tight">
            Từ ý tưởng tới việc-đã-giao trong 5 phút.
          </h1>
          <p className="mt-4 max-w-[34ch] text-lg text-white/90">
            Không gian làm việc có AI lập kế hoạch, giao việc và theo dõi từng phase — cho cá
            nhân và cả team.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-5 text-sm text-white/90">
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" /> Bảo mật theo workspace
          </span>
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> Song ngữ Việt / Anh
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI lập kế hoạch
          </span>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] lg:hidden" />
        <div className="relative w-full max-w-sm animate-fade-in">
          <div className="mb-8">
            <div className="mb-5 inline-flex items-center gap-2 lg:hidden">
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
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">Bắt đầu nào</h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              Đăng nhập để tạo không gian của bạn. Không cần thẻ, không cần cài đặt.
            </p>
          </div>
          <LoginForm showDevBypass={devBypassEnabled} />
          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-mint" />
            Chúng tôi không lưu mật khẩu — đăng nhập an toàn qua nhà cung cấp.
          </p>
        </div>
      </div>
    </div>
  );
}
