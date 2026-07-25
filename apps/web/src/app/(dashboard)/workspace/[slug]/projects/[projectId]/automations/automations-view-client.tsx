"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { Plus, Trash2, Zap } from "lucide-react";
import {
  deleteAutomationAction,
  retryAutomationRunAction,
  toggleAutomationAction,
} from "@/modules/automation/automation.actions";
import { AutomationForm } from "./automation-form";
import { AUTOMATION_TRIGGER_LABELS } from "@/modules/automation/automation.schema";

interface RunRow {
  id: string;
  status: string;
  chainDepth: number;
  startedAt: Date | string;
  error: string | null;
}

interface AutomationRow {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  isActive: boolean;
  targetEntityId: string | null;
  conditions: { field: string; op: string; value: unknown }[];
  actions: { type: string; params: Record<string, unknown> }[];
  recentRuns: RunRow[];
}

interface StatusOption {
  id: string;
  name: string;
  type: string;
}
interface MemberOption {
  id: string;
  fullName: string;
}
interface BlockerOption {
  id: string;
  title: string;
}
interface TaskOption {
  id: string;
  title: string;
}

interface Props {
  workspaceId: string;
  /** null = workspace-wide automations page (no single owning project). */
  projectId: string | null;
  workspaceSlug: string;
  initialAutomations: AutomationRow[];
  statuses?: StatusOption[];
  members?: MemberOption[];
  blockers?: BlockerOption[];
  tasks?: TaskOption[];
  initialTaskId?: string;
}

export function AutomationsViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialAutomations,
  statuses = [],
  members = [],
  blockers = [],
  tasks = [],
  initialTaskId,
}: Props) {
  const router = useRouter();
  const [automations, setAutomations] = useState(initialAutomations);
  const [showForm, setShowForm] = useState(!!initialTaskId);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  async function handleToggle(automationId: string, isActive: boolean) {
    setAutomations((current) =>
      current.map((a) => (a.id === automationId ? { ...a, isActive } : a))
    );
    const res = await toggleAutomationAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      automationId,
      isActive,
    });
    if (!res.ok) {
      toast.error(res.error);
      setAutomations((current) =>
        current.map((a) => (a.id === automationId ? { ...a, isActive: !isActive } : a))
      );
    }
  }

  async function handleDelete(automationId: string) {
    if (!confirm("Delete this automation?")) return;
    const previous = automations;
    setAutomations((current) => current.filter((a) => a.id !== automationId));
    const res = await deleteAutomationAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      automationId,
    });
    if (!res.ok) {
      toast.error(res.error);
      setAutomations(previous);
    } else {
      toast.success("Automation deleted");
      router.refresh();
    }
  }

  async function handleRetry(automationRunId: string) {
    setRetryingRunId(automationRunId);
    const res = await retryAutomationRunAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      automationRunId,
    });
    setRetryingRunId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Retry finished: ${res.data}`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold tracking-[-0.014em]">Automations</h2>
        </div>
        <Button variant="dark" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> New automation
        </Button>
      </div>

      {showForm && (
        <AutomationForm
          workspaceId={workspaceId}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          statuses={statuses}
          members={members}
          blockers={blockers}
          tasks={tasks}
          initialTaskId={initialTaskId}
          onCreated={() => {
            setShowForm(false);
            router.refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {automations.length === 0 && (
          <p className="text-sm text-muted-foreground">No automations yet.</p>
        )}
        {automations.map((automation) => (
          <div key={automation.id} className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{automation.name}</div>
                <div className="text-sm text-muted-foreground">
                  {AUTOMATION_TRIGGER_LABELS[automation.triggerType] ?? automation.triggerType} ·{" "}
                  {automation.actions.length} action(s) · {automation.conditions.length} condition(s)
                  {automation.targetEntityId && " · Chỉ 1 task cụ thể"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={automation.isActive}
                    onChange={(e) => handleToggle(automation.id, e.target.checked)}
                  />
                  Active
                </label>
                <Button variant="outline" onClick={() => handleDelete(automation.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {automation.recentRuns.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pr-4">Status</th>
                    <th className="pr-4">Depth</th>
                    <th className="pr-4">Started</th>
                    <th className="pr-4">Error</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {automation.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="pr-4">{run.status}</td>
                      <td className="pr-4">{run.chainDepth}</td>
                      <td className="pr-4">{new Date(run.startedAt).toLocaleString()}</td>
                      <td className="max-w-[200px] truncate pr-4">{run.error ?? ""}</td>
                      <td>
                        {(run.status === "failed" || run.status === "timed_out") && (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            disabled={retryingRunId === run.id}
                            onClick={() => handleRetry(run.id)}
                          >
                            {retryingRunId === run.id ? "Retrying…" : "Retry"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
