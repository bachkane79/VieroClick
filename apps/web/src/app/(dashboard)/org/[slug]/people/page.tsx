import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, FolderKanban } from "lucide-react";
import {
  getOrganization,
  listOrganizationMembers,
  listOrganizationWorkspaces,
} from "@/modules/organization/organization.service";
import { memberInitials } from "@/modules/task/status-colors";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  admin: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  member: "bg-muted text-muted-foreground",
};

export default async function OrgPeoplePage({ params }: Props) {
  const { slug } = await params;

  let org;
  let members;
  let workspaces;
  try {
    org = await getOrganization(slug);
    [members, workspaces] = await Promise.all([
      listOrganizationMembers(slug),
      listOrganizationWorkspaces(slug),
    ]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-lg font-bold uppercase">
          {org.name.charAt(0)}
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Building2 className="h-3.5 w-3.5" />
            Organization
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* People directory */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">People</h2>
            <span className="text-xs text-muted-foreground">{members.length} thành viên</span>
          </div>
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {memberInitials(m.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                    ROLE_BADGE[m.role] ?? ROLE_BADGE.member
                  }`}
                >
                  {m.role}
                </span>
              </div>
            ))}
            {members.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Chưa có thành viên. Đưa một team vào tổ chức để chia sẻ danh bạ.
              </p>
            )}
          </div>
        </section>

        {/* Teams in this org */}
        <aside className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Teams</h2>
          </div>
          <div className="divide-y">
            {workspaces.map((w) => (
              <Link
                key={w.id}
                href={`/workspace/${w.slug}`}
                className="flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{w.name}</span>
              </Link>
            ))}
            {workspaces.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Chưa có team nào trong tổ chức. Vào một team và chọn “Đưa team này vào” ở switcher.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
