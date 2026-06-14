import { auth } from "@/server/auth";
import { getWorkspacesByUser } from "@/modules/workspace/queries";

export default async function DashboardPage() {
  const session = await auth();
  const workspaces = await getWorkspacesByUser(session!.user.id);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {workspaces.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No workspaces yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <a
              key={ws.id}
              href={`/workspace/${ws.slug}`}
              className="block rounded-lg border bg-card p-4 hover:border-primary transition-colors"
            >
              <h2 className="font-semibold">{ws.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{ws.slug}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
