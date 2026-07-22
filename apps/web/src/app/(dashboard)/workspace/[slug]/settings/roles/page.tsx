import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, Minus, Lock, Info } from "lucide-react";
import type { WorkspaceRole, PermissionLevel } from "@vieroc/types";
import type { ActorContext } from "@/server/lib/context";
import {
  isWorkspaceAdmin,
  isProjectManager,
  canCreateProject,
  isReviewer,
  roleDefaultLevel,
} from "@/server/lib/permissions";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

// The workspace roles we describe, ordered strongest → weakest.
const ROLES: { role: WorkspaceRole; label: string }[] = [
  { role: "owner", label: "Owner" },
  { role: "admin", label: "Admin" },
  { role: "leader", label: "Leader" },
  { role: "member", label: "Member" },
  { role: "viewer", label: "Viewer" },
  { role: "guest", label: "Guest" },
];

/** Build a workspace-level synthetic actor (no project context) for a role. */
function ctxFor(role: WorkspaceRole): ActorContext {
  return {
    userId: "",
    workspaceId: "",
    workspaceMemberId: "",
    workspaceRole: role,
    projectId: null,
    projectRole: null,
  };
}

// Management capabilities, evaluated against the REAL predicates in
// server/lib/permissions.ts so this table can never drift from enforcement.
const CAPABILITIES: { label: string; hint: string; test: (c: ActorContext) => boolean }[] = [
  {
    label: "Quản trị cài đặt & bảo mật workspace",
    hint: "isWorkspaceAdmin",
    test: isWorkspaceAdmin,
  },
  { label: "Tạo dự án mới", hint: "canCreateProject", test: canCreateProject },
  {
    label: "Quản lý dự án, thành viên & task",
    hint: "isProjectManager",
    test: isProjectManager,
  },
  { label: "Duyệt báo cáo & review task", hint: "isReviewer", test: isReviewer },
  {
    label: "Chạy AI agent & duyệt gợi ý",
    hint: "isProjectManager",
    test: isProjectManager,
  },
];

const LEVEL_META: Record<
  PermissionLevel | "none",
  { label: string; cls: string; desc: string }
> = {
  full: {
    label: "Full",
    cls: "border-primary/25 bg-primary/10 text-primary",
    desc: "Toàn quyền: sửa, chia sẻ, xóa, đổi quyền.",
  },
  edit: {
    label: "Edit",
    cls: "border-success/30 bg-success/10 text-success",
    desc: "Sửa nội dung & task, nhưng không đổi quyền / xóa cấp cao.",
  },
  comment: {
    label: "Comment",
    cls: "border-warning/30 bg-warning/10 text-warning",
    desc: "Xem và bình luận, không sửa nội dung.",
  },
  view: {
    label: "View",
    cls: "border-border bg-secondary text-muted-foreground",
    desc: "Chỉ đọc.",
  },
  none: {
    label: "Cần được chia sẻ",
    cls: "border-dashed border-border bg-transparent text-muted-foreground",
    desc: "Không có quyền mặc định — phải được chia sẻ từng mục.",
  },
};

function LevelChip({ level }: { level: PermissionLevel | "none" }) {
  const m = LEVEL_META[level];
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default async function WorkspaceRolesSettingsPage({ params }: Props) {
  const { slug } = await params;
  try {
    await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const roleLevels = ROLES.map((r) => ({
    ...r,
    level: (roleDefaultLevel(ctxFor(r.role)) ?? "none") as PermissionLevel | "none",
  }));

  const matrix = CAPABILITIES.map((cap) => ({
    ...cap,
    values: ROLES.map((r) => cap.test(ctxFor(r.role))),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Vai trò &amp; Quyền</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mô hình quyền &ldquo;Hybrid&rdquo;: vai trò định mức truy cập mặc định, còn chia sẻ theo
          từng mục sẽ ghi đè lên trên.
        </p>
      </header>

      {/* Two-layer explainer */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lớp 1 · Vai trò
          </p>
          <p className="mt-1 text-sm text-foreground">
            Vai trò workspace (Owner → Guest) đặt <span className="font-medium">mức mặc định</span>{" "}
            cho mọi mục công khai và quyết định ai quản trị được.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lớp 2 · Chia sẻ theo mục
          </p>
          <p className="mt-1 text-sm text-foreground">
            Cấp quyền cho từng dự án/task/doc (cá nhân hoặc{" "}
            <Link href={`/workspace/${slug}/settings/teams`} className="font-medium text-primary hover:underline">
              team
            </Link>
            ) — mục cụ thể + mức cao nhất thắng.
          </p>
        </div>
      </section>

      {/* Default access level per role */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">Mức truy cập mặc định theo vai trò</h2>
          <p className="text-sm text-muted-foreground">Áp dụng cho mục công khai khi chưa chia sẻ riêng.</p>
        </header>
        <ul className="divide-y divide-border">
          {roleLevels.map((r) => (
            <li key={r.role} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground">{LEVEL_META[r.level].desc}</p>
              </div>
              <LevelChip level={r.level} />
            </li>
          ))}
        </ul>
      </section>

      {/* Capability matrix */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">Khả năng quản trị</h2>
          <p className="text-sm text-muted-foreground">
            Suy ra trực tiếp từ <code className="rounded bg-secondary px-1 py-0.5 text-xs">server/lib/permissions.ts</code>{" "}
            — bảng luôn khớp với code thực thi.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 text-left">Khả năng</th>
                {ROLES.map((r) => (
                  <th key={r.role} className="px-3 py-3 text-center">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrix.map((cap) => (
                <tr key={cap.label} className="transition-colors hover:bg-surface-hover">
                  <td className="px-5 py-3 text-left text-foreground">{cap.label}</td>
                  {cap.values.map((v, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      {v ? (
                        <Check className="mx-auto h-4 w-4 text-success" aria-label="Có" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Không" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The four levels */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">4 mức quyền chi tiết</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(["full", "edit", "comment", "view"] as PermissionLevel[]).map((lvl) => (
            <li key={lvl} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <LevelChip level={lvl} />
              <p className="text-sm text-muted-foreground">{LEVEL_META[lvl].desc}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Thứ tự resolve: người tạo → owner/admin → grant cá nhân → grant team → mục riêng tư/guest
          không có grant = không truy cập → mức mặc định của vai trò.
        </p>
      </section>

      {/* Custom roles — migration-gated next step */}
      <section className="rounded-xl border border-dashed border-border bg-surface-subtle p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-secondary p-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Vai trò tùy chỉnh (sắp có)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Giống ClickUp Custom Roles: tạo vai trò riêng và bật/tắt từng khả năng. Việc này cần
              một bảng <code className="rounded bg-secondary px-1 py-0.5 text-xs">role_permissions</code>{" "}
              mới (migration DB) — sẽ triển khai sau khi thống nhất, vì DB Neon đang dùng chung.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
