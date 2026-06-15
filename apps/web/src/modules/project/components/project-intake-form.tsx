"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { createProjectAction } from "../project.actions";

interface WorkspaceMemberOption {
  id: string;
  role: string;
  email: string;
  fullName: string;
  title: string | null;
  department: string | null;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  members: WorkspaceMemberOption[];
}

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProjectIntakeForm({ workspaceId, workspaceSlug, members }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);

    const leadMemberId = String(formData.get("leadMemberId") ?? "");
    const targetEndDate = String(formData.get("targetEndDate") ?? "");

    const payload = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      scope: String(formData.get("scope") ?? "") || undefined,
      status: String(formData.get("status") ?? "active"),
      leadMemberId: leadMemberId || undefined,
      targetEndDate: targetEndDate || undefined,
      goals: lines(String(formData.get("goals") ?? "")),
      constraints: lines(String(formData.get("constraints") ?? "")),
      expectedDeliverables: lines(String(formData.get("expectedDeliverables") ?? "")),
      memberIds: selectedMemberIds,
      initialContext: String(formData.get("initialContext") ?? "") || undefined,
    };

    const result = await createProjectAction({
      workspaceId,
      slug: workspaceSlug,
      data: payload,
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Project created");
    router.push(`/workspace/${workspaceSlug}/projects/${result.data.id}/overview`);
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  }

  return (
    <form action={onSubmit} className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="project-name" className="text-sm font-medium">
                Project name
              </label>
              <Input id="project-name" name="name" required maxLength={200} autoFocus />
            </div>

            <div className="grid gap-2">
              <label htmlFor="project-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea id="project-description" name="description" className="min-h-24" />
            </div>

            <div className="grid gap-2">
              <label htmlFor="project-scope" className="text-sm font-medium">
                Scope
              </label>
              <Textarea id="project-scope" name="scope" className="min-h-28" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="project-deadline" className="text-sm font-medium">
                  Deadline
                </label>
                <Input id="project-deadline" name="targetEndDate" type="date" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="project-status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="project-status"
                  name="status"
                  defaultValue="active"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="project-lead" className="text-sm font-medium">
                Lead
              </label>
              <select
                id="project-lead"
                name="leadMemberId"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Current user</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium">Members</p>
              <div className="max-h-[360px] overflow-y-auto rounded-md border">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{member.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <label htmlFor="project-goals" className="text-sm font-medium">
              Goals
            </label>
            <Textarea id="project-goals" name="goals" className="min-h-36" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="project-constraints" className="text-sm font-medium">
              Constraints
            </label>
            <Textarea id="project-constraints" name="constraints" className="min-h-36" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="project-deliverables" className="text-sm font-medium">
              Expected deliverables
            </label>
            <Textarea
              id="project-deliverables"
              name="expectedDeliverables"
              className="min-h-36"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-2">
          <label htmlFor="project-context" className="text-sm font-medium">
            Initial context
          </label>
          <Textarea id="project-context" name="initialContext" className="min-h-40" />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create project"}
        </Button>
      </div>
    </form>
  );
}
