# VieroClick × Band AI — 6-Agent Project Manager

The six AI agents from the VieroClick design plan (§7.4–7.9), each connected to a
[Band AI](https://band.ai) **External Agent** and collaborating in a shared Band
chat room via `@mentions` and embedded JSON payloads.

---

## 🤖 The 6 agents

| # | Agent | Band handle | Design | What it does |
|---|-------|-------------|--------|--------------|
| 1 | **Planner** | `@bachkane79/planner` | §7.4 | Turns a project abstract into a plan (tasks, milestones, risks); waits for human **approve**; then creates the project + tasks in VieroClick and hands off to the assigner. |
| 2 | **Assigner** | `@bachkane79/assigner` | §7.5 | Recommends the best member per task (skill/load match), writes assignees to VieroClick, posts the final assigned plan. |
| 3 | **Observer** | `@bachkane79/observer` | §7.6 | Scans project health and flags signals (silent assignee, overdue, unclear blocker, missing acceptance criteria, …). |
| 4 | **Daily Report** | `@bachkane79/daily-report` | §7.7 | Drafts the leader end-of-day report (progress, risks, blockers, member demands, plan deviations, actions). |
| 5 | **Morning Briefing** | `@bachkane79/morning-briefing` | §7.8 | Per-member + project briefings for the day; optional Telegram broadcast. |
| 6 | **Q&A + Hole** | `@bachkane79/qa-and-hole` | §7.9 | Answers project questions from context **and** detects "project holes" (missing info the leader must clarify). |

---

## 🔄 Workflows

**Planning pipeline (HITL-gated):**

```
Human ──@planner [abstract]──▶ Planner
Planner ──posts plan + asks approval──▶ Human
Human ──"approve"──▶ Planner ──creates project+tasks in VieroClick──▶ @assigner
Assigner ──writes assignees to VieroClick──▶ posts final assigned plan
```

**Standalone (mention any time):**

```
@observer                     → risk-signal scan
@daily-report                 → leader end-of-day report
@morning-briefing             → per-member morning briefing
@qa-and-hole  <câu hỏi>       → grounded answer + project holes
```

The observation/reporting agents read live data from VieroClick (`/api/test-db`);
if the app is not running they fall back to a realistic mock snapshot so the demo
still works (see [shared/context.py](shared/context.py)).

---

## 🏗️ Project structure

```
band-agents/
├── agents/
│   ├── planner/           # §7.4 — plan + HITL + create in VieroClick
│   ├── assigner/          # §7.5 — recommend + assign
│   ├── observer/          # §7.6 — signal detection
│   ├── daily_report/      # §7.7 — leader report
│   ├── morning_briefing/  # §7.8 — per-member briefing
│   └── qa_hole/           # §7.9 — Q&A + hole detection
├── shared/
│   ├── base_adapter.py    # common Band wiring (mention gating, room context)
│   ├── vieroc_client.py   # HTTP client for the VieroClick app
│   ├── context.py         # live/mock project-context loader
│   ├── llm.py             # unified OpenAI/Anthropic caller
│   ├── message_parser.py  # JSON payload + approval-keyword parsing
│   └── hitl.py            # human-in-the-loop prompt helpers
├── run_all.py             # launch all 6 agents concurrently
├── agent_config.yaml      # Band agent IDs + API keys (gitignored)
└── .env                   # LLM keys, VieroClick config, handles (gitignored)
```

Each `agents/<name>/main.py` subclasses `BandAgentAdapter` and implements
`handle_message`; all the Band connection boilerplate lives in
[shared/base_adapter.py](shared/base_adapter.py).

---

## 🚀 Quick start

1. **Install** (Python 3.11+):
   ```bash
   cd band-agents
   pip install -r requirements.txt
   ```
2. **Create 6 External Agents** at [app.band.ai/agents](https://app.band.ai/agents)
   with handles `planner, assigner, observer, daily-report, morning-briefing, qa-and-hole`,
   invite all 6 + yourself to one Band room.
3. **Configure**:
   - Copy [agent_config.yaml.example](agent_config.yaml.example) → `agent_config.yaml`
     and fill in each agent's UUID + API key. The top-level keys must stay
     `planner / assigner / observer / daily_report / morning_briefing / qa_hole`.
   - Copy [.env.example](.env.example) → `.env`, set an LLM key (`OPENAI_API_KEY`
     or `ANTHROPIC_API_KEY`), `VIEROC_API_URL/TOKEN`, and the `*_HANDLE` values to
     your prefixed handles (e.g. `@bachkane79/planner`).
4. **Run**:
   ```bash
   python run_all.py
   ```
   Then in the Band room: `@bachkane79/planner Xây dựng tính năng thông báo realtime ...`

---

## 🛠️ Tech stack

| Component | Technology |
|---|---|
| Agent mesh | [Band AI](https://band.ai) + `band-sdk` (WebSockets) |
| LLM | OpenAI (`gpt-4o-mini`) **or** Anthropic (`claude-3-5-sonnet`) — auto-detected |
| PM app | VieroClick (Next.js 15 + Drizzle ORM + Neon PostgreSQL) |
| HTTP | `httpx` |

---

MIT — Built for the Band of Agents Hackathon 2026
