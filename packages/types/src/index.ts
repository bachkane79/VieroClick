// Enums
export type WorkspaceRole = "owner" | "admin" | "leader" | "member" | "viewer";
export type ProjectRole = "project_lead" | "tech_lead" | "member" | "reviewer" | "stakeholder";
export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type TaskStatusType =
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type BlockerStatus = "open" | "in_review" | "resolved" | "ignored";
export type AgentJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type ProjectDocType =
  | "requirement"
  | "technical_note"
  | "decision"
  | "meeting_note"
  | "scope"
  | "other";

// Core entities
export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  title: string | null;
  department: string | null;
  joinedAt: Date;
}

export interface MemberProfile {
  id: string;
  workspaceMemberId: string;
  skills: string[];
  seniorityLevel: number;
  availabilityHoursPerWeek: number | null;
  timezone: string | null;
  reliabilityScore: number;
  speedScore: number;
  qualityScore: number;
  communicationScore: number;
  blockerHandlingScore: number;
  profileNotes: string | null;
  updatedByAgentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  leadMemberId: string | null;
  startDate: string | null;
  targetEndDate: string | null;
  goals: string[];
  constraints: string[];
  expectedDeliverables: string[];
  initialContext: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  workspaceMemberId: string;
  role: ProjectRole;
  allocationPercent: number;
}

export interface TaskStatus {
  id: string;
  projectId: string;
  name: string;
  type: TaskStatusType;
  position: number;
  isDefault: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  statusId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assigneeMemberId: string | null;
  reporterMemberId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  actualHours: number | null;
  acceptanceCriteria: string[];
  labels: string[];
  position: number;
  isMilestone: boolean;
  createdBy: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorMemberId: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyUpdate {
  id: string;
  projectId: string;
  memberId: string;
  workDate: string;
  completedText: string | null;
  inProgressText: string | null;
  blockersText: string | null;
  confidenceLevel: number | null;
  supportNeeded: string | null;
  concerns: string | null;
  submittedAt: Date;
}

export interface Blocker {
  id: string;
  projectId: string;
  taskId: string | null;
  reportedByMemberId: string | null;
  title: string;
  description: string | null;
  status: BlockerStatus;
  severity: TaskPriority;
  ownerMemberId: string | null;
  resolvedByMemberId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentJob {
  id: string;
  projectId: string | null;
  jobType: string;
  status: AgentJobStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  requestedByUserId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface AgentSuggestion {
  id: string;
  projectId: string;
  jobId: string | null;
  suggestionType: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
  reviewedByMemberId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  projectId: string | null;
  actorUserId: string | null;
  actorMemberId: string | null;
  actorType: "human" | "agent" | "system";
  entityType: string;
  entityId: string;
  eventType: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
