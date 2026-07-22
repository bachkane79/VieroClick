/**
 * Starter templates for the onboarding wizard (B2C spec §6).
 *
 * Pure data — imported by BOTH the client wizard (for card previews) and the
 * server service (for seeding). No "server-only" here. Content is Vietnamese
 * (primary market); the bilingual VI/EN pass lands with the i18n slice.
 *
 * Each seeded task carries its phase name as a label so the flat task list can
 * later be grouped by phase without a schema change (WBS-phase seeding is a
 * follow-up). `dueOffset` is days from the moment of creation.
 */
import type { OnboardingTemplate } from "@vieroc/validators";

export type SeedTask = {
  title: string;
  /** Days from now for the due date. */
  dueOffset: number;
  priority?: "low" | "medium" | "high";
};

export type SeedPhase = { phase: string; tasks: SeedTask[] };

export type TemplateDef = {
  id: OnboardingTemplate;
  /** lucide-react icon name, resolved in the client. */
  icon: string;
  /** Tailwind text/bg color token used for the card icon tile. */
  tone: string;
  name: string;
  description: string;
  /** Default project name (pre-filled, editable). */
  projectName: string;
  seed: SeedPhase[];
};

export const TEMPLATES: Record<Exclude<OnboardingTemplate, "ai-generated">, TemplateDef> = {
  "personal-planning": {
    id: "personal-planning",
    icon: "House",
    tone: "emerald",
    name: "Kế hoạch cá nhân",
    description: "Việc đời sống, mục tiêu và thói quen.",
    projectName: "Kế hoạch của tôi",
    seed: [
      {
        phase: "Tuần này",
        tasks: [
          { title: "Lập danh sách việc tuần này", dueOffset: 0 },
          { title: "Chọn 3 việc quan trọng nhất", dueOffset: 0, priority: "high" },
          { title: "Review cuối tuần", dueOffset: 6 },
        ],
      },
      {
        phase: "Mục tiêu tháng",
        tasks: [
          { title: "Đặt 1 mục tiêu lớn của tháng", dueOffset: 1 },
          { title: "Chia mục tiêu thành 3 bước", dueOffset: 2 },
        ],
      },
    ],
  },
  study: {
    id: "study",
    icon: "GraduationCap",
    tone: "sky",
    name: "Học tập",
    description: "Deadline, môn học và dự án nhóm.",
    projectName: "Học kỳ này",
    seed: [
      {
        phase: "Deadline sắp tới",
        tasks: [
          { title: "Nộp bài tập môn ___", dueOffset: 3, priority: "high" },
          { title: "Ôn kiểm tra ___", dueOffset: 5 },
        ],
      },
      {
        phase: "Môn học đang theo",
        tasks: [
          { title: "Ghi chú bài giảng tuần này", dueOffset: 0 },
          { title: "Đọc tài liệu chương ___", dueOffset: 2 },
        ],
      },
    ],
  },
  "freelance-client": {
    id: "freelance-client",
    icon: "Zap",
    tone: "amber",
    name: "Freelance / khách hàng",
    description: "Chạy một job từ brief tới thanh toán.",
    projectName: "Dự án khách hàng",
    seed: [
      {
        phase: "Brief & báo giá",
        tasks: [
          { title: "Nhận brief từ khách", dueOffset: 0 },
          { title: "Gửi báo giá / hợp đồng", dueOffset: 1, priority: "high" },
        ],
      },
      {
        phase: "Thực hiện",
        tasks: [
          { title: "Bản nháp đầu tiên", dueOffset: 4 },
          { title: "Gửi khách review", dueOffset: 5 },
        ],
      },
      {
        phase: "Bàn giao & thanh toán",
        tasks: [
          { title: "Bàn giao file cuối", dueOffset: 10 },
          { title: "Gửi hóa đơn / theo dõi", dueOffset: 11, priority: "high" },
        ],
      },
    ],
  },
  "small-team-project": {
    id: "small-team-project",
    icon: "Users",
    tone: "rose",
    name: "Dự án nhóm nhỏ",
    description: "Dựng chỗ làm việc chung cho nhóm.",
    projectName: "Dự án nhóm",
    seed: [
      {
        phase: "Khởi động",
        tasks: [
          { title: "Chốt mục tiêu & phạm vi", dueOffset: 1, priority: "high" },
          { title: "Phân vai trong nhóm", dueOffset: 1 },
        ],
      },
      {
        phase: "Thực thi",
        tasks: [
          { title: "Hạng mục A", dueOffset: 5 },
          { title: "Hạng mục B", dueOffset: 5 },
          { title: "Đồng bộ tiến độ giữa kỳ", dueOffset: 4 },
        ],
      },
      {
        phase: "Hoàn tất",
        tasks: [
          { title: "Rà soát chất lượng", dueOffset: 9 },
          { title: "Tổng kết & bàn giao", dueOffset: 10 },
        ],
      },
    ],
  },
  blank: {
    id: "blank",
    icon: "Plus",
    tone: "violet",
    name: "Bắt đầu trống",
    description: "Một dự án trống với 1 việc mở đầu.",
    projectName: "Dự án của tôi",
    seed: [
      {
        phase: "Việc cần làm",
        tasks: [{ title: "Bấm để sửa — đây là task đầu tiên của bạn", dueOffset: 1 }],
      },
    ],
  },
};

/** Card metadata for the AI path (no static seed — the planner fills the plan). */
export const AI_TEMPLATE = {
  id: "ai-generated" as const,
  icon: "Sparkles",
  tone: "violet",
  name: "Để AI dựng giúp",
  description: "Tả dự án bằng một câu — AI phác kế hoạch cho bạn duyệt.",
  projectName: "Dự án mới",
};

/** Templates offered per mode, in display order (spec §5.3). */
export const TEMPLATE_ORDER: Record<"personal" | "team", (keyof typeof TEMPLATES)[]> = {
  personal: ["personal-planning", "study", "freelance-client", "blank"],
  team: ["small-team-project", "freelance-client", "personal-planning", "blank"],
};
