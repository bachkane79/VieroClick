import Link from "next/link";
import { ArrowUpRight, Briefcase } from "lucide-react";
import { listMyWorkspaces } from "@/modules/workspace/workspace.service";

export default async function DashboardPage() {
  const workspaces = await listMyWorkspaces();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 animate-fade-in">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Overview</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Your workspaces</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Pick a workspace to jump into projects, tasks, and reports.
        </p>
      </div>

      {workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Briefcase className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">No workspaces yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first workspace to start managing projects with your AI
            project manager.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspace/${ws.slug}`}
              className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="mb-8 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-foreground text-lg font-bold uppercase text-background">
                  {ws.name.charAt(0)}
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <div>
                <h2 className="font-bold tracking-tight">{ws.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">/{ws.slug}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
