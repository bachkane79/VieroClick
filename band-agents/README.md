# VieroClick × Band AI — Multi-Agent Pipeline

A **5-agent AI pipeline** built for the [Band of Agents Hackathon](https://lablab.ai/ai-hackathons/band-of-agents-hackathon), integrating VieroClick (a Next.js project management app) with [Band AI](https://band.ai) for real-time multi-agent collaboration.

---

## 🏗️ Architecture & Workflows

Band AI operates as a collaborative "agentic mesh". Instead of calling APIs sequentially in code, agents communicate in real-time in a shared **Band Chat Room** using `@mentions` and JSON payloads.

```mermaid
graph TD
    %% Define Styles
    classDef human fill:#ececff,stroke:#9370db,stroke-width:2px;
    classDef agent fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px;
    classDef db fill:#e8f5e9,stroke:#4caf50,stroke-width:2px;
    
    %% Elements
    Human["🧑‍💼 Leader (Human)"]:::human
    Planner["📋 Planner Agent<br>(@planner)"]:::agent
    Notifier["🔔 Notifier Agent<br>(@notifier)"]:::agent
    Assigner["🛠️ Assigner Agent<br>(@developer)"]:::agent
    QA["💬 QA Chatbot Agent<br>(@qa-agent)"]:::agent
    Reporter["📊 Reporter Agent<br>(@reviewer)"]:::agent
    VieroDB[("🗄️ VieroClick DB<br>(Neon PostgreSQL)")]:::db

    %% Main Pipeline Flow
    Human -->|1. Nhập Project Abstract| Planner
    Planner -->|2. Yêu cầu Duyệt| Human
    Human -->|3. Gõ 'approve'| Planner
    Planner -->|4. Gửi Plan| Notifier
    Notifier -->|5. Tạo Tasks & Timeline| VieroDB
    Notifier -->|6. Chuyển tiếp Task list| Assigner
    Assigner -->|7. Phân bổ Assignee| Notifier
    Notifier -->|8. Cập nhật Assignee| VieroDB
    Notifier -->|9. Báo cáo hoàn thành| Human

    %% Standalone Agents
    Human -.->|Mention @qa-agent [Câu hỏi]| QA
    Human -.->|Mention @reviewer sáng/tối| Reporter
    Reporter -.->|Đọc thay đổi timestamp| VieroDB
```

---

## 🔄 Pipeline Workflow Details

### 🛠️ Workflow 1: Project Planning & Assignment
This workflow connects planning, backend sync, and member task assignment in one continuous loop:

1. **Planner Agent** (`@planner`):
   - Receives the raw abstract request from the Leader.
   - Generates a structured JSON plan with prioritized **tasks**, **milestones** (timeline), and **risks**.
   - Asks for Leader approval: *"Type **approve** to create the project plan."*
2. **Leader types `approve`** in the room.
3. **Notifier Agent** (`@notifier` — Stage 1):
   - Receives the approved plan, makes HTTP calls to the VieroClick local server to create the tasks and milestones.
   - Captures the created task IDs, then mentions the Assigner agent (`@developer`) to allocate team members.
4. **Assigner Agent** (`@developer`):
   - Reads the task categories and maps them to your **real team members** based on their hackathon responsibilities:
     - **Người 1** (`member_1`): Auth, Notifications, Webhooks, Telegram.
     - **Người 2** (`member_2`): Projects, Task system, Gantt charts, Milestones.
     - **Người 3** (`member_3`): Comments, File uploads, Daily updates, Risks.
   - Recommends the optimal assignees, then mentions the Notifier agent (`@notifier`).
5. **Notifier Agent** (`@notifier` — Stage 2):
   - Receives the assignments, calls the VieroClick API to update the assignees in the database.
   - Announces the complete, fully assigned project plan in the chat room!

---

### 📅 Workflow 2: Daily Morning & Evening Reports
Provides status summaries directly in the chat room (manually triggered for easy demoing):

- **Morning Report** (Trigger: `@reviewer morning` or `@reviewer sáng`):
  - Automatically synthesizes active tasks, daily goals, and blockers.
  - Lists what needs to be worked on today by Người 1, 2, and 3.
- **Evening Report** (Trigger: `@reviewer evening` or `@reviewer tối`):
  - Compares the morning database/task state against the evening database/task state (comparing timestamps).
  - Outlines completed tasks, updated progresses, resolved blockers, and lists action items for tomorrow.

---

### 💬 Standalone QA Chatbot
- **QA Chatbot** (Trigger: `@qa-agent [Question]`):
  - A standalone chatbot that anyone can mention to ask questions about VieroClick's tech stack (Next.js 14, tRPC, Drizzle, PostgreSQL), modules, or team responsibilities.
  - Responds dynamically in natural language (Vietnamese).

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.11+
- A [Band AI](https://app.band.ai) account
- API key: OpenAI or Anthropic (single model provider setup)
- VieroClick running at `localhost:3000`

### 2. Install dependencies
```bash
cd d:\Project\band-agents
pip install -r requirements.txt
```

### 3. Configure Band agents
1. Go to [app.band.ai/agents](https://app.band.ai/agents)
2. Create 5 **External Agents** with these exact handles and tags:
   - **Planner**: handle `planner`, tags: `pm, plan, task`
   - **Assigner**: handle `developer`, tags: `team, dev, role`
   - **QA Chatbot**: handle `qa-agent`, tags: `qa, bot, chat`
   - **Reporter**: handle `reviewer`, tags: `report, log, status`
   - **Notifier**: handle `notifier`, tags: `sync, api, link`
3. Copy the API key and Agent UUID for each.
4. Fill them in `agent_config.yaml` (see [agent_config.yaml.example](file:///d:/Project/band-agents/agent_config.yaml.example)).

### 4. Configure environment
1. Copy `.env.example` to `.env`.
2. Fill in: `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`), `VIEROC_API_TOKEN`, and `BAND_ROOM_ID`.

### 5. Run all agents
```bash
python run_all.py
```

---

## 📁 Project Structure

```
band-agents/
├── agents/
│   ├── planner/      # Planner Agent (System prompt planning)
│   ├── developer/    # Assigner Agent (Team skill mapping)
│   ├── qa/           # QA Chatbot Agent (Project info lookup)
│   ├── reviewer/     # Reporter Agent (Morning/Evening comparison reports)
│   └── notifier/     # Notifier Agent & VieroClick Client (API sync)
├── shared/
│   ├── hitl.py           # Human-in-the-loop gate helpers
│   ├── llm.py            # Unified single-LLM provider wrapper
│   ├── message_parser.py # Band room message JSON parser
│   └── state.py          # Pipeline states
├── run_all.py        # Launch all 5 agents concurrently
├── requirements.txt
└── agent_config.yaml
```

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Agent Mesh | [Band AI](https://band.ai) + band-sdk (WebSockets) |
| Core LLM Engine | OpenAI (GPT-4o-mini) OR Anthropic (Claude-3.5-Sonnet) |
| PM App | VieroClick (Next.js 14 + tRPC + Drizzle ORM + PostgreSQL) |
| HTTP Clients | `httpx` (for VieroClick backend integrations) |

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | For Planner (GPT-4o) |
| `ANTHROPIC_API_KEY` | Yes | For Developer, QA, Reviewer, Notifier |
| `VIEROC_API_URL` | Yes | VieroClick app URL |
| `VIEROC_API_TOKEN` | Yes | Auth token for VieroClick API |
| `TELEGRAM_BOT_TOKEN` | Optional | For Telegram notifications |
| `TELEGRAM_CHAT_ID` | Optional | Telegram chat/channel ID |
| `VIEROC_DEFAULT_PROJECT_ID` | Optional | Default project for task creation |

---

## 📜 License

MIT — Built for Band of Agents Hackathon 2026
