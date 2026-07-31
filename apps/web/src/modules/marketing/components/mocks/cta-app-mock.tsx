import { Bot, ChevronDown, Circle, Filter, Hash, Home, Inbox, Lock, MessageSquare, Plus, Sparkles, UserRound } from "lucide-react";
import { cn } from "@vieroc/ui";
import { AvatarStack } from "./app-chrome";

/**
 * The closing band's product mock.
 *
 * Rounded on the top corners only and given no bottom radius or padding: the
 * band crops it, so it reads as the app continuing below the fold rather than a
 * card floating in a gradient. The phone panel overlaps its right edge and is
 * cropped by the same boundary.
 */
export function CtaAppMock() {
  return (
    <div className="relative w-full max-w-[980px]">
      <div className="overflow-hidden rounded-t-[16px] border border-white/40 bg-surface shadow-elevated">
        <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-subtle px-4">
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="mx-auto flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-0.5 text-[10px] text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
            app.vieroclick.vn
          </span>
        </div>

        <div className="flex h-[280px]">
          <div className="flex w-12 shrink-0 flex-col items-center gap-1 bg-[#14171F] py-3">
            <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground">
              M
            </span>
            {[Home, Hash, MessageSquare, Sparkles].map((Icon, i) => (
              <span key={i} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35">
                <Icon className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>

          <div className="w-[184px] shrink-0 border-r border-border bg-surface-subtle p-3">
            <div className="flex items-center gap-1.5 pb-3">
              <span className="text-[11px] font-bold text-foreground">Marketing Team</span>
              <ChevronDown className="ml-auto h-3 w-3 text-text-disabled" />
            </div>
            {[
              { Icon: Inbox, l: "Hộp thư" },
              { Icon: UserRound, l: "Task của tôi" },
            ].map(({ Icon, l }) => (
              <div key={l} className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
                <Icon className="h-3 w-3 text-text-disabled" />
                <span className="text-[11px] font-medium text-text-secondary">{l}</span>
              </div>
            ))}
            <p className="px-1.5 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-text-disabled">
              Dự án
            </p>
            {[
              { l: "Chiến dịch Q3", c: "bg-primary", active: true },
              { l: "Sản phẩm mới", c: "bg-lavender" },
              { l: "Tài sản thương hiệu", c: "bg-mint" },
            ].map((p) => (
              <div
                key={p.l}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1.5",
                  p.active && "bg-surface-hover"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", p.c)} />
                <span
                  className={cn(
                    "truncate text-[11px]",
                    p.active ? "font-semibold text-foreground" : "font-medium text-text-secondary"
                  )}
                >
                  {p.l}
                </span>
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-5 border-b border-border px-4">
              {["Danh sách", "Bảng", "Gantt"].map((tab) => (
                <span
                  key={tab}
                  className={cn(
                    "border-b-2 py-2.5 text-[11px]",
                    tab === "Danh sách"
                      ? "border-primary font-semibold text-primary"
                      : "border-transparent font-medium text-text-secondary"
                  )}
                >
                  {tab}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-2">
                <Filter className="h-3 w-3 text-text-disabled" />
                <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                  <Plus className="h-2.5 w-2.5" />
                  Thêm task
                </span>
              </span>
            </div>

            <div className="px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-primary">
                <span className="h-1 w-1 rounded-full bg-current" />
                Đang làm
              </span>
              <span className="ml-2 text-[11px] text-text-disabled">2</span>
            </div>

            {[
              { l: "Cập nhật trang Landing Page", p: ["Đ", "A"] },
              { l: "Thiết kế bộ banner Ads mới", p: ["T"] },
            ].map((r) => (
              <div
                key={r.l}
                className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5"
              >
                <Circle className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                <span className="truncate text-[11px] font-medium text-foreground">{r.l}</span>
                <AvatarStack names={r.p} className="ml-auto shrink-0" />
              </div>
            ))}

            <div className="px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-mint">
                <span className="h-1 w-1 rounded-full bg-current" />
                Hoàn thành
              </span>
              <span className="ml-2 text-[11px] text-text-disabled">12</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phone panel, overlapping the frame and cropped by the same edge. */}
      <div className="absolute -right-2 bottom-0 hidden w-[210px] overflow-hidden rounded-t-[20px] border-x border-t border-white/50 bg-[#14171F] shadow-elevated md:block">
        <div className="flex items-center justify-between px-3.5 pb-2 pt-2.5">
          <span className="text-[9px] font-semibold text-white">9:41</span>
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </span>
        </div>
        <div className="flex items-center gap-2 border-b border-white/10 px-3.5 pb-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-3 w-3" />
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-bold text-white">VieroClick Bot</p>
            <p className="text-[8px] text-white/45">bot</p>
          </div>
        </div>
        <div className="space-y-2 px-3.5 py-3">
          <p className="text-center text-[8px] font-medium text-white/35">Hôm nay</p>
          <div className="rounded-lg rounded-bl-sm bg-white/8 px-2.5 py-2">
            <p className="text-[9px] text-white/85">
              <span className="font-semibold text-primary">@Bao_cao</span> Doanh thu tuần này đạt{" "}
              <span className="font-bold text-white">125%</span> mục tiêu.
            </p>
            <p className="mt-1 text-right text-[8px] text-white/35">09:41</p>
          </div>
          <div className="ml-auto w-[80%] rounded-lg rounded-br-sm bg-primary px-2.5 py-2">
            <p className="text-[9px] text-primary-foreground">Tuyệt vời, gửi chi tiết nhé!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
