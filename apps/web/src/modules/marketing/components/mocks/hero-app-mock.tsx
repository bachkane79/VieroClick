import Image from "next/image";
import {
  AlertTriangle,
  Bot,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Hash,
  Home,
  Inbox,
  Kanban,
  LayoutGrid,
  ListTodo,
  Info,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@vieroc/ui";
import { statusColor } from "@/modules/task/status-colors";
import { AvatarStack } from "./app-chrome";

/**
 * The hero's product mock — a reproduction of the app's project list view.
 *
 * This is a *reproduction*, not a screenshot, and the difference is the point:
 * it renders from the same tokens and the same `statusColor()` map the product
 * uses, so restyling the app restyles the mock instead of silently making the
 * landing page lie. It also stays sharp at any DPR and costs no image bytes in
 * the LCP element.
 *
 * That only holds if it stays honest, so the chrome tracks real source:
 *   - light 80px icon rail, logo-first  → `components/layout/app-sidebar.tsx`
 *   - six tabs, icon + short underline  → `.../[projectId]/project-nav.tsx`
 *   - group pills and row dots          → `modules/task/status-colors.ts`
 *   - group cards on canvas, column row → `modules/task/components/task-list.tsx`
 *
 * Deliberately drawn wider than its slot: the hero crops it against the right
 * viewport edge, which is what sells it as a running app rather than a picture
 * pasted onto a page. Everything here is illustrative, so the whole tree is
 * `aria-hidden` and the hero copy carries the meaning instead.
 */

type Row = {
  title: string;
  people: string[];
  due: string;
  priority: "Cao" | "Trung bình" | "Thấp";
  attach?: boolean;
  comment?: boolean;
};

const DONE_ROWS: Row[] = [
  {
    title: "Thiết kế banner chiến dịch",
    people: ["L", "MA"],
    due: "Hôm qua",
    priority: "Trung bình",
  },
  { title: "Bộ ảnh sản phẩm", people: ["AI"], due: "Hôm qua", priority: "Thấp", attach: true },
];

const DOING_ROWS: Row[] = [
  { title: "Nghiên cứu đối thủ", people: ["Đ", "TU"], due: "Hôm nay", priority: "Cao" },
  {
    title: "Kịch bản email",
    people: ["M", "DA"],
    due: "Ngày mai",
    priority: "Trung bình",
    comment: true,
  },
  { title: "Tích hợp ZaloPay", people: ["L", "Đ", "TU"], due: "24 Thg 10", priority: "Cao" },
];

const PRIORITY_TINT: Record<Row["priority"], string> = {
  Cao: "text-amber-500",
  "Trung bình": "text-blue-500",
  Thấp: "text-neutral-400",
};

export function HeroAppMock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex overflow-hidden rounded-l-shell border border-border bg-surface",
        className
      )}
    >
      <IconRail />
      <ContextPanel />
      <div className="flex min-w-[716px] flex-1 flex-col">
        <TopBar />
        <ProjectTabs />
        <ListView />
      </div>
    </div>
  );
}

/**
 * Light rail, 80px, logo first — the app's actual shell. An earlier revision
 * drew this as a dark 56px rail, which was the single loudest reason the mock
 * read as a different product.
 */
function IconRail() {
  const items = [
    { Icon: Home, active: false },
    { Icon: Inbox, active: false },
    { Icon: LayoutGrid, active: true },
    { Icon: CalendarCheck, active: false },
    { Icon: Sparkles, active: false },
    { Icon: Users, active: false },
    { Icon: FileText, active: false },
  ];

  return (
    <div className="flex w-20 shrink-0 flex-col items-center border-r border-border bg-surface py-6">
      <span className="mb-6 grid h-10 w-10 place-items-center">
        <Image
          src="/logo_transparent.png"
          alt=""
          width={34}
          height={34}
          className="h-[34px] w-[34px] object-contain"
        />
      </span>

      <nav className="flex flex-1 flex-col items-center gap-3">
        {items.map(({ Icon, active }, i) => (
          <span
            key={i}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl",
              active ? "bg-primary/10 text-primary" : "text-text-secondary"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
          </span>
        ))}
      </nav>

      <span className="grid h-10 w-10 place-items-center rounded-xl text-text-secondary">
        <Settings className="h-5 w-5" strokeWidth={1.75} />
      </span>
    </div>
  );
}

function ContextPanel() {
  return (
    <div className="w-56 shrink-0 border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-3 py-3.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-soft text-[10px] font-bold text-primary">
          M
        </span>
        <span className="truncate text-[13px] font-semibold text-foreground">Công ty Mango</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-text-disabled" />
      </div>

      <nav className="px-2">
        <PanelRow Icon={Inbox} label="Hộp thư" badge={3} />
        <PanelRow Icon={ListTodo} label="Task của tôi" />
      </nav>

      <PanelGroup label="Dự án">
        <PanelRow Icon={Hash} label="Marketing" active />
        <PanelRow Icon={Hash} label="Chiến dịch Q3" />
        <PanelRow Icon={Hash} label="Sản phẩm" />
      </PanelGroup>

      <PanelGroup label="Thành viên">
        <MemberRow initials="MA" name="Minh Anh" badge={1} tint="bg-mint-soft text-mint" />
        <MemberRow name="AI Agent" badge={3} tint="bg-lavender-soft text-lavender" ai />
      </PanelGroup>
    </div>
  );
}

function PanelGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 pb-2">
      <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function PanelRow({
  Icon,
  label,
  badge,
  active,
}: {
  Icon: typeof Inbox;
  label: string;
  badge?: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5",
        active && "bg-surface-hover"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-text-secondary")}
      />
      <span
        className={cn(
          "truncate text-[13px]",
          active ? "font-semibold text-foreground" : "text-foreground/90"
        )}
      >
        {label}
      </span>
      {badge ? <Badge n={badge} /> : null}
    </div>
  );
}

function MemberRow({
  initials,
  name,
  badge,
  tint,
  ai,
}: {
  initials?: string;
  name: string;
  badge: number;
  tint: string;
  ai?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
          tint
        )}
      >
        {ai ? <Bot className="h-3 w-3" /> : initials}
      </span>
      <span className={cn("truncate text-[13px]", ai ? "text-lavender" : "text-foreground/90")}>
        {name}
      </span>
      <Badge n={badge} />
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}

/** Breadcrumb, not a page heading — the app deliberately has no duplicate <h1>. */
function TopBar() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
      <span className="text-[13px] text-text-secondary">Công ty Mango</span>
      <ChevronRight className="h-3.5 w-3.5 text-text-disabled" />
      <span className="text-[13px] font-semibold text-foreground">Marketing</span>

      <span className="ml-6 flex h-8 w-64 items-center gap-2 rounded-full border border-border px-3 text-[13px] text-text-disabled">
        <Search className="h-3.5 w-3.5" />
        Tìm kiếm
      </span>

      <span className="ml-auto flex items-center gap-3">
        <AvatarStack names={["MA", "Đ", "L"]} />
        <span className="flex h-8 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-[13px] font-medium text-white">
          <Plus className="h-3.5 w-3.5" />
          Task mới
        </span>
      </span>
    </div>
  );
}

/** The six fixed tabs, in `project-nav.tsx` order. Active = dark label + short orange underline. */
function ProjectTabs() {
  const tabs = [
    { label: "Tổng quan", Icon: Info },
    { label: "Danh sách", Icon: ListTodo },
    { label: "Bảng", Icon: Kanban },
    { label: "Báo cáo", Icon: ClipboardList },
    { label: "AI Manager", Icon: Sparkles },
    { label: "Rủi ro & Cột mốc", Icon: AlertTriangle },
  ];

  return (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-border bg-surface px-4">
      {tabs.map(({ label, Icon }) => {
        const active = label === "Danh sách";
        return (
          <span
            key={label}
            className={cn(
              "relative flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[13px]",
              active ? "font-semibold text-foreground" : "font-medium text-text-secondary"
            )}
          >
            <Icon
              className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-text-secondary")}
            />
            {label}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </span>
        );
      })}
      <span className="flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium text-text-secondary">
        <Plus className="h-3.5 w-3.5" />
        Thêm view
      </span>
    </div>
  );
}

/** Grouped list on canvas: each status group is its own bordered card. */
function ListView() {
  return (
    <div className="flex-1 space-y-4 bg-canvas p-4">
      <StatusGroup type="done" label="Hoàn thành" rows={DONE_ROWS} />
      <StatusGroup type="in_progress" label="Đang làm" rows={DOING_ROWS} />
      <CollapsedGroup type="todo" label="Chưa làm" count={4} />
      <AgentTray />
    </div>
  );
}

function GroupPill({
  type,
  label,
  count,
}: {
  type: "done" | "in_progress" | "todo";
  label: string;
  count: number;
}) {
  return (
    <>
      <span
        className={cn(
          "rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
          statusColor(type).pill
        )}
      >
        {label}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{count}</span>
    </>
  );
}

function StatusGroup({
  type,
  label,
  rows,
}: {
  type: "done" | "in_progress";
  label: string;
  rows: Row[];
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
        <GroupPill type={type} label={label} count={rows.length} />
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
        <div className="grid grid-cols-[300px_116px_104px_84px] border-b border-border bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Task</span>
          <span>Người làm</span>
          <span>Hạn</span>
          <span>Ưu tiên</span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <TaskRow key={row.title} row={row} type={type} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CollapsedGroup({
  type,
  label,
  count,
}: {
  type: "todo";
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <GroupPill type={type} label={label} count={count} />
    </div>
  );
}

/**
 * Columns are fixed-width and left-packed rather than pushed apart with a
 * `1fr` title column. The hero crops this mock at the viewport edge, and a
 * right-aligned meta column would always be the part that gets cut — so the
 * name column is capped and the meta follows immediately, leaving the empty
 * gutter to absorb the crop instead. (The app itself uses `minmax(260px,1fr)`
 * there, which is correct on a real full-width screen.)
 */
function TaskRow({ row, type }: { row: Row; type: "done" | "in_progress" }) {
  return (
    <div className="grid grid-cols-[300px_116px_104px_84px] items-center px-4 py-2.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-sm", statusColor(type).dot)} />
        <span className="truncate font-medium text-foreground">{row.title}</span>
        {row.attach ? <Paperclip className="h-3 w-3 shrink-0 text-text-disabled" /> : null}
        {row.comment ? <MessageSquare className="h-3 w-3 shrink-0 text-text-disabled" /> : null}
      </span>
      <AvatarStack names={row.people} />
      <span className="text-[13px] text-text-secondary">{row.due}</span>
      <span className={cn("text-[13px] font-medium", PRIORITY_TINT[row.priority])}>
        {row.priority}
      </span>
    </div>
  );
}

/** The agent activity tray — the product's signature surface, drawn as it ships. */
function AgentTray() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hoạt động AI
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Đang chạy
        </span>
      </div>
      <div className="divide-y divide-border">
        <ActivityRow
          icon={<Bot className="h-3 w-3" />}
          tint="bg-brand-soft text-primary"
          body="Agent Phân công đã giao lại 3 task trễ hạn"
          when="1 giờ trước"
        />
        <ActivityRow
          icon={<span className="text-[9px] font-bold">MA</span>}
          tint="bg-mint-soft text-mint"
          body="Minh Anh đã hoàn thành Thiết kế banner chiến dịch"
          when="10 phút trước"
        />
      </div>
    </div>
  );
}

function ActivityRow({
  icon,
  tint,
  body,
  when,
}: {
  icon: React.ReactNode;
  tint: string;
  body: string;
  when: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", tint)}>
        {icon}
      </span>
      <span className="truncate text-[13px] text-foreground">{body}</span>
      <span className="shrink-0 text-[11px] text-text-disabled">· {when}</span>
    </div>
  );
}
