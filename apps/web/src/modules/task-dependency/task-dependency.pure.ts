export interface DependencyEdge {
  blockerTaskId: string;
  blockedTaskId: string;
}

export type CycleCheckResult = { cycle: false } | { cycle: true; path: string[] };

/**
 * Would adding `candidate` (blocker -> blocked) create a cycle in the existing
 * dependency graph? Edges point blocker -> blocked, so a cycle exists iff there
 * is already a path from candidate.blockedTaskId back to candidate.blockerTaskId.
 */
export function wouldCreateCycle(
  edges: DependencyEdge[],
  candidate: DependencyEdge
): CycleCheckResult {
  if (candidate.blockerTaskId === candidate.blockedTaskId) {
    return { cycle: true, path: [candidate.blockerTaskId] };
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.blockerTaskId);
    if (next) {
      next.push(edge.blockedTaskId);
    } else {
      adjacency.set(edge.blockerTaskId, [edge.blockedTaskId]);
    }
  }

  const target = candidate.blockerTaskId;
  const start = candidate.blockedTaskId;

  const visited = new Set<string>([start]);
  const queue: string[] = [start];
  const cameFrom = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) {
      const path: string[] = [target];
      let node = target;
      while (node !== start) {
        node = cameFrom.get(node)!;
        path.unshift(node);
      }
      return { cycle: true, path };
    }

    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      cameFrom.set(next, current);
      queue.push(next);
    }
  }

  return { cycle: false };
}
