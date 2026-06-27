# VieroClick — 6-Agent Local Project Manager Service

The six AI agents from the VieroClick design plan (§7.4–7.9). **Band.ai has been
removed**: the agents no longer connect to a chat room or use `@mentions`. They
now run as a single **local FastAPI service** and are invoked over plain HTTP
(`POST /agents/{role}`) — normal request/response data streams. All reasoning
uses the company **Gemini API**.

---

## 🤖 The 6 agents

| # | Role (`/agents/{role}`) | Design | What it does |
|---|---|---|---|
| 1 | **planning** | §7.4 | Turns project intake into a plan (WBS, tasks, milestones, dependencies, risks) and applies it to VieroClick. Uses `gemini-2.5-pro`. |
| 2 | **assignment** | §7.5 | Scores members per task (skill/load/seniority/reliability) and applies assignees to VieroClick. |
| 3 | **observer** | §7.6 | Scans project health and creates suggestions (silent assignee, overdue, unclear blocker, missing acceptance criteria, …). |
| 4 | **daily_report** | §7.7 | Drafts the pending leader end-of-day report (progress, risks, blockers, member demands, plan deviations, actions). |
| 5 | **morning_briefing** | §7.8 | Per-member + project briefings; in-app notifications + optional Telegram broadcast. |
| 6 | **project_qa** | §7.9 | Answers project questions from context **and** detects "project holes" (missing info the leader must clarify). |

Agents 2–6 use `gemini-2.5-flash`.

---

## 🔄 How it works

Each agent is a plain `async def run(project_id, payload) -> dict` in
`agents/<role>/main.py`. `server.py` registers them and exposes:

```
POST /agents/{role}     body: { "projectId": "...", "payload": {...}, "question": "..." }
GET  /health
```

Orchestration is driven by the VieroClick web app (no inter-agent chat mesh):

```
Create project ─POST /agents/planning─▶ planner applies plan to VieroClick
apply-plan     ─POST /agents/assignment─▶ assigner writes assignees to VieroClick
observer / daily_report / morning_briefing / project_qa ── invoked on demand
```

Agents read/write live data through the VieroClick REST API
(`shared/vieroc_client.py`); they never touch the database directly.

---

## 🏗️ Project structure

```
band-agents/
├── agents/
│   ├── planning/          # §7.4 — plan + apply to VieroClick
│   ├── assignment/        # §7.5 — score + assign
│   ├── observer/          # §7.6 — health scan → suggestions
│   ├── daily_report/      # §7.7 — leader report
│   ├── morning_briefing/  # §7.8 — per-member briefing
│   └── project_qa/        # §7.9 — Q&A + hole detection
├── shared/
│   ├── vieroc_client.py   # HTTP client for the VieroClick app
│   ├── llm.py             # Gemini caller (company API)
│   └── message_parser.py  # JSON payload extraction
├── server.py              # FastAPI app: POST /agents/{role}
├── run_all.py             # launch the local service (uvicorn)
└── .env                   # GEMINI_API_KEY, VieroClick config (gitignored)
```

---

## 🚀 Quick start

1. **Install** (Python 3.11+):
   ```bash
   cd band-agents
   pip install -r requirements.txt
   ```
2. **Configure** — copy [.env.example](.env.example) → `.env` and set:
   - `GEMINI_API_KEY` (company Gemini API) — `GEMINI_MODEL` defaults to
     `gemini-2.5-flash`, `PLANNING_MODEL` to `gemini-2.5-pro`.
   - `VIEROC_API_URL` / `VIEROC_API_TOKEN` (must match `AGENT_API_SECRET` in the web app).
   - Optional `AGENT_SERVICE_PORT` (default `8001`) and `AGENT_SERVICE_SECRET`.
3. **Run**:
   ```bash
   python run_all.py
   ```
4. **Invoke** (or let the web app dispatch automatically):
   ```bash
   curl -X POST http://localhost:8001/agents/planning \
     -H "Content-Type: application/json" \
     -H "X-Api-Secret: <AGENT_SERVICE_SECRET or VIEROC_API_TOKEN>" \
     -d '{"projectId":"<uuid>"}'
   ```

---

## 🛠️ Tech stack

| Component | Technology |
|---|---|
| Transport | FastAPI + uvicorn (local HTTP, no Band.ai) |
| LLM | Company **Gemini API** via `google-genai` (`gemini-2.5-flash` / `gemini-2.5-pro`) |
| PM app | VieroClick (Next.js 15 + Drizzle ORM + Neon PostgreSQL) |
| HTTP | `httpx` |
