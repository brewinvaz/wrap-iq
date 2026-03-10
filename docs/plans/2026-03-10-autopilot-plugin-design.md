# Autopilot Plugin — Implementation Specification

> **For Claude Code:** This document is the complete specification to implement the `autopilot` plugin.
> Read it fully before writing any file. All design decisions are final. Implement exactly as specified.

## Context

No existing Claude Code skill automates the full app development lifecycle: PRD intake → clarification → scaffolding → issue decomposition → implementation in worktrees → CI/CD → QA → security hardening. We manually ran parts of this workflow for WrapIQ and now want to codify it as a reusable, publishable plugin.

## Design Principles

1. **Ask before building** — 3-pass clarification engine before any code
2. **Monorepo by default** — Docker Compose hybrid (Compose for orchestration, native for fast tests)
3. **The ADR is the single source of truth** — Machine-readable `services-map.json` + human-readable decisions
4. **One issue = one worktree = one PR** — Clean isolation
5. **Semi-autonomous** — Pause for complex features, pause between phases
6. **Crash-recoverable** — `.autopilot/state.json` persists session state
7. **Quality gates** — Coverage thresholds (80% lines, 70% branches), reviewer confidence ≥80
8. **Generic** — Auto-discovers project board IDs at runtime via `gh` CLI
9. **Graceful stop** — `.autopilot/stop` sentinel file checked between issues

## 6-Phase Lifecycle

| Phase | Name | Key Skills | Output |
|-------|------|-----------|--------|
| 0 | Intake & Clarification | prd-intake, clarification-engine | ADR + services-map.json |
| 1 | Scaffolding | monorepo-scaffolding, service-scaffolding, ci-cd-generation | Monorepo with CI/CD |
| 2 | Spec Decomposition | spec-decomposition | GitHub issues on project board |
| 3 | Implementation Loop | issue-lifecycle, parallel-issue-dispatch | PRs merged per issue |
| 4 | Integration & QA | integration-qa | Test reports |
| 5 | Final Hardening | security-hardening, final-report | Security report + summary |

## Plugin Structure

```
autopilot/                          # ~/repos/autopilot
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── autopilot.md                # /autopilot — backlog mode (existing repos)
│   ├── autopilot-build.md          # /autopilot-build PRD.md — full 6-phase lifecycle
│   ├── autopilot-spec.md           # /autopilot-spec <path> — decompose spec only
│   ├── autopilot-suggest.md        # /autopilot-suggest — triage backlog
│   ├── autopilot-status.md         # /autopilot-status — board + session state
│   ├── autopilot-resume.md         # /autopilot-resume — resume from crash/stop
│   └── autopilot-stop.md           # /autopilot-stop — graceful stop
├── skills/
│   ├── state-manager/
│   │   └── SKILL.md                # Session state persistence + crash recovery
│   ├── project-board-discovery/
│   │   └── SKILL.md                # Auto-discover project board config
│   ├── prd-intake/
│   │   └── SKILL.md                # Read PRD + mockups, extract requirements
│   ├── clarification-engine/
│   │   └── SKILL.md                # 3-pass clarification → ADR
│   ├── monorepo-scaffolding/
│   │   └── SKILL.md                # Generate monorepo from ADR
│   ├── service-scaffolding/
│   │   └── SKILL.md                # Scaffold per-service (FastAPI, Next.js, etc.)
│   ├── ci-cd-generation/
│   │   └── SKILL.md                # GitHub Actions from templates
│   ├── spec-decomposition/
│   │   └── SKILL.md                # ADR → GitHub issues
│   ├── issue-triage/
│   │   └── SKILL.md                # Analyze backlog, prioritize
│   ├── issue-lifecycle/
│   │   └── SKILL.md                # Single issue: worktree → implement → PR → merge
│   ├── parallel-issue-dispatch/
│   │   └── SKILL.md                # Up to 3 parallel worktree agents
│   ├── integration-qa/
│   │   └── SKILL.md                # Cross-service integration tests
│   ├── security-hardening/
│   │   └── SKILL.md                # OWASP, Trivy, Bandit, trufflehog
│   └── final-report/
│       └── SKILL.md                # Completion summary
├── agents/
│   ├── clarification-agent.md      # Drives 3-pass clarification
│   ├── scaffold-agent.md           # Monorepo + service scaffolds
│   ├── issue-implementer.md        # Implements one issue in worktree
│   ├── issue-reviewer.md           # Reviews against acceptance criteria
│   └── qa-agent.md                 # Integration + E2E tests
├── templates/
│   ├── github-actions/
│   │   ├── ci-backend.yml          # Python/FastAPI CI
│   │   ├── ci-frontend.yml         # Next.js CI
│   │   └── ci-docker.yml           # Docker build + push
│   ├── docker/
│   │   ├── Dockerfile.python
│   │   ├── Dockerfile.node
│   │   └── docker-compose.yml
│   ├── makefiles/
│   │   ├── Makefile.root
│   │   └── Makefile.service
│   ├── claude-md.template
│   └── issue-body.template
├── scripts/
│   ├── discover-project-board.sh
│   ├── check-stop-sentinel.sh
│   └── coverage-check.sh
├── README.md
└── LICENSE
```

## State Management

Session state persisted to `.autopilot/state.json`:
```json
{
  "session_id": "uuid",
  "phase": "implementation",
  "current_issue": 42,
  "completed_issues": [38, 39, 40],
  "blocked_issues": [41],
  "board_config": { "PROJECT_ID": "...", "FIELD_ID": "...", "..." : "..." },
  "adr_path": "docs/adr/001-initial.md",
  "started_at": "2026-03-10T10:00:00Z",
  "last_checkpoint": "2026-03-10T12:30:00Z"
}
```

- Checkpoint after each issue completion and phase transition
- `.autopilot/stop` sentinel checked between issues for graceful halt
- `/autopilot-resume` loads state and continues from last checkpoint

## Clarification Engine (3-Pass)

**Pass 1 — Blocking architecture:**
- Service count and stack per service
- Auth strategy, database topology
- External integrations
- Must answer before scaffolding

**Pass 2 — Feature scope:**
- Acceptance criteria per feature
- MVP vs post-MVP classification
- Dependency ordering

**Pass 3 — Implementation preferences (with defaults):**
- Package managers (default: npm/uv)
- Linting (default: ruff/eslint)
- Testing (default: pytest/vitest)
- CI provider (default: GitHub Actions)

Output: ADR with `services-map.json` + architecture decisions markdown.

## ADR Format

Machine-readable `services-map.json`:
```json
{
  "services": [
    {
      "name": "backend",
      "stack": "fastapi",
      "language": "python",
      "port": 8000,
      "database": "postgres",
      "dependencies": []
    },
    {
      "name": "frontend",
      "stack": "nextjs",
      "language": "typescript",
      "port": 3000,
      "dependencies": ["backend"]
    }
  ],
  "shared": {
    "auth": "jwt",
    "ci": "github-actions",
    "containerization": "docker-compose"
  }
}
```

## Quality Gates

| Gate | Threshold | When |
|------|-----------|------|
| Line coverage | ≥80% | Per PR |
| Branch coverage | ≥70% | Per PR |
| Reviewer confidence | ≥80 | Per PR |
| Security scan | 0 critical | Phase 5 |
| Integration tests | All pass | Phase 4 |

## Implementation Tasks

### Task 1: Plugin scaffold + metadata

Create `autopilot/.claude-plugin/plugin.json`:
```json
{
  "name": "autopilot",
  "description": "End-to-end app development automation: PRD intake, scaffolding, issue lifecycle, CI/CD, QA, and security hardening",
  "version": "1.0.0",
  "author": { "name": "brewinvaz" },
  "license": "MIT",
  "keywords": ["autopilot", "github", "project-board", "issues", "automation", "worktrees", "scaffolding", "ci-cd"]
}
```

Create full directory structure and all empty placeholder files.

---

### Task 2: `state-manager` skill

**File:** `autopilot/skills/state-manager/SKILL.md`

Manages `.autopilot/state.json` for crash recovery:
```json
{
  "session_id": "uuid",
  "phase": "implementation",
  "current_issue": 42,
  "completed_issues": [38, 39, 40],
  "blocked_issues": [41],
  "board_config": { "PROJECT_ID": "...", "FIELD_ID": "..." },
  "adr_path": "docs/adr/001-initial.md",
  "started_at": "ISO8601",
  "last_checkpoint": "ISO8601"
}
```

Operations:
- `init` — Create new session state
- `checkpoint` — Save current progress
- `resume` — Load state from last checkpoint
- `complete` — Mark session done

Check `.autopilot/stop` sentinel between issues for graceful halt.

---

### Task 3: `project-board-discovery` skill

**File:** `autopilot/skills/project-board-discovery/SKILL.md`

Auto-discovers GitHub Project board configuration at runtime:
1. Get repo owner: `gh repo view --json owner -q '.owner.login'`
2. List projects: `gh project list --owner OWNER --format json`
3. If multiple, pick the one matching repo name or ask user
4. Get fields: `gh project field-list N --owner OWNER --format json`
5. Find "Status" field, extract option IDs
6. Output: `PROJECT_ID`, `PROJECT_NUM`, `FIELD_ID`, `BACKLOG_ID`, `READY_ID`, `IN_PROGRESS_ID`, `IN_REVIEW_ID`, `DONE_ID`

Also create `autopilot/scripts/discover-project-board.sh`.

---

### Task 4: `prd-intake` skill

**File:** `autopilot/skills/prd-intake/SKILL.md`

Reads PRD document + optional mockup images:
1. Read PRD at provided path
2. If `--mockups` path provided, read image files for UI context
3. Extract: project name, tech stack preferences, feature list, non-functional requirements
4. Identify ambiguities and unknowns for clarification engine
5. Output structured requirements object

---

### Task 5: `clarification-engine` skill

**File:** `autopilot/skills/clarification-engine/SKILL.md`

3-pass clarification before any code is written:

**Pass 1 — Blocking architecture questions:**
- How many services? What stack for each?
- Auth strategy? Database per service or shared?
- Any external integrations?
- Questions that MUST be answered before scaffolding

**Pass 2 — Feature scope:**
- For each feature: confirm acceptance criteria
- Identify MVP vs post-MVP features
- Dependency ordering between features

**Pass 3 — Implementation preferences (with defaults):**
- Package managers (default: npm for JS, uv for Python)
- Linting (default: ruff for Python, eslint for JS)
- Testing frameworks (default: pytest, vitest)
- CI provider (default: GitHub Actions)

After all passes, generate ADR document with:
- `services-map.json` — machine-readable service definitions
- Architecture decisions in human-readable markdown

---

### Task 6: `monorepo-scaffolding` skill

**File:** `autopilot/skills/monorepo-scaffolding/SKILL.md`

Generates monorepo structure from ADR:
1. Read `services-map.json` from ADR
2. Create root: `Makefile`, `docker-compose.yml`, `.github/`, `docs/`
3. For each service, invoke `service-scaffolding` skill
4. Generate `CLAUDE.md` from template with project conventions
5. Create initial commit

---

### Task 7: `service-scaffolding` skill

**File:** `autopilot/skills/service-scaffolding/SKILL.md`

Scaffolds individual services based on stack:
- **FastAPI**: `app/main.py`, `app/config.py`, `app/db.py`, `app/routers/`, `tests/`, `pyproject.toml`, `Dockerfile`
- **Next.js**: `src/app/`, `src/lib/`, `src/components/`, `package.json`, `Dockerfile`
- **Generic**: Adapts to any stack defined in services-map.json

Uses templates from `templates/` directory.

---

### Task 8: `ci-cd-generation` skill

**File:** `autopilot/skills/ci-cd-generation/SKILL.md`

Generates CI/CD pipelines from templates:
1. Read services-map.json for service list and stacks
2. For each service, select appropriate CI template
3. Generate `.github/workflows/ci-{service}.yml`
4. Add Docker build workflow if Dockerfiles present
5. Configure coverage thresholds (80% lines, 70% branches)

---

### Task 9: `spec-decomposition` skill

**File:** `autopilot/skills/spec-decomposition/SKILL.md`

Parses ADR + PRD into implementable GitHub issues:
1. Read ADR and PRD
2. Break features into discrete issues (1 issue per bounded scope)
3. For each issue: title, body from template, acceptance criteria, dependency ordering
4. Detect complexity heuristics (multi-subsystem, security, migrations → label `complex`)
5. Create issues: `gh issue create --title "..." --body "..." --project "ProjectName"`
6. Set status to Backlog
7. Present decomposed list to user for confirmation before creating

---

### Task 10: `issue-triage` skill

**File:** `autopilot/skills/issue-triage/SKILL.md`

Analyzes open issues and produces prioritized recommendation:
1. Fetch all open issues with project status, labels, bodies
2. Analyze dependencies, backend readiness, complexity, independence
3. Classify: Ready / Blocked / Complex
4. Group "Ready" issues into parallelizable batches
5. Present recommendation with size estimates

---

### Task 11: `issue-lifecycle` skill

**File:** `autopilot/skills/issue-lifecycle/SKILL.md`

Core loop for a single issue:

**Setup:**
1. Get issue project item ID, move to "In progress"
2. Create worktree: `git worktree add .worktrees/issue-{number} -b issue-{number}-{slug}`

**Implement:**
3. If `complex` label → pause, present approach, wait for approval
4. Dispatch `issue-implementer` agent in worktree
5. Agent: explore → implement → test → lint → commit

**PR & Merge:**
6. Push branch, create PR with `Closes #{number}`
7. Move to "In review"
8. `gh pr checks --watch` — wait for CI
9. On pass: `gh pr merge --rebase --delete-branch`
10. Move to "Done", cleanup worktree
11. Checkpoint state

**Error handling:**
- CI failure → show details, ask user: fix/skip
- Merge conflict → attempt rebase, if fails report
- Tests fail → agent retries 3x, then BLOCKED

---

### Task 12: `parallel-issue-dispatch` skill

**File:** `autopilot/skills/parallel-issue-dispatch/SKILL.md`

Dispatches up to 3 agents in parallel:
1. Accept issues (max 3), verify independence
2. Each agent dispatched with `isolation: "worktree"`
3. Each: implement → commit → push
4. Merge sequentially: PR → CI → merge → rebase next on updated main
5. Move each to "Done", report summary

---

### Task 13: `integration-qa` skill

**File:** `autopilot/skills/integration-qa/SKILL.md`

Phase 4 quality assurance:
1. Spin up all services via Docker Compose
2. Run cross-service integration tests
3. Verify API contract compatibility between services
4. Run E2E user flows if applicable
5. Dispatch `qa-agent` for automated review
6. Report coverage metrics and any failures

---

### Task 14: `security-hardening` skill

**File:** `autopilot/skills/security-hardening/SKILL.md`

Phase 5 final hardening:
1. OWASP dependency check (if Java/JS)
2. `pip-audit` / `npm audit` for dependency vulnerabilities
3. Bandit scan for Python security issues
4. `trufflehog` for leaked secrets in git history
5. Trivy container scan on built images
6. Generate security report, flag critical issues for user

---

### Task 15: `final-report` skill

**File:** `autopilot/skills/final-report/SKILL.md`

Generate completion summary:
- Issues completed / blocked / skipped
- Coverage metrics per service
- Security scan results
- Time elapsed per phase
- Remaining work recommendations

---

### Task 16: Agents

**`agents/clarification-agent.md`:**
```yaml
---
name: clarification-agent
description: Drives 3-pass clarification dialogue with user to produce ADR
tools: Glob, Grep, LS, Read, Write, Edit, Bash, WebFetch, TodoWrite
model: sonnet
color: cyan
---
```

**`agents/scaffold-agent.md`:**
```yaml
---
name: scaffold-agent
description: Generates monorepo and service scaffolds from ADR
tools: Glob, Grep, LS, Read, Write, Edit, Bash, TodoWrite
model: sonnet
color: green
---
```

**`agents/issue-implementer.md`:**
```yaml
---
name: issue-implementer
description: Implements a single GitHub issue in an isolated worktree
tools: Glob, Grep, LS, Read, Write, Edit, Bash, NotebookRead, WebFetch, TodoWrite
model: sonnet
color: blue
---
```
Receives: issue number, title, body, acceptance criteria, board config, branch name.
Workflow: Read CLAUDE.md → explore code → implement → test/lint → commit → return DONE|BLOCKED|NEEDS_DISCUSSION

**`agents/issue-reviewer.md`:**
```yaml
---
name: issue-reviewer
description: Reviews implementation against issue acceptance criteria
tools: Glob, Grep, LS, Read, NotebookRead, Bash, WebFetch, TodoWrite
model: sonnet
color: red
---
```
Confidence scoring ≥80 threshold.

**`agents/qa-agent.md`:**
```yaml
---
name: qa-agent
description: Runs integration tests and validates cross-service compatibility
tools: Glob, Grep, LS, Read, Bash, WebFetch, TodoWrite
model: sonnet
color: yellow
---
```

---

### Task 17: Templates

Create all template files:
- `templates/github-actions/ci-backend.yml` — Python/FastAPI CI
- `templates/github-actions/ci-frontend.yml` — Next.js CI
- `templates/github-actions/ci-docker.yml` — Docker build + push
- `templates/docker/Dockerfile.python` — Python service Dockerfile
- `templates/docker/Dockerfile.node` — Node.js service Dockerfile
- `templates/docker/docker-compose.yml` — Compose template with service placeholders
- `templates/makefiles/Makefile.root` — Root Makefile (up/down/logs/test)
- `templates/makefiles/Makefile.service` — Per-service Makefile
- `templates/claude-md.template` — CLAUDE.md template for generated repos
- `templates/issue-body.template` — GitHub issue body template

---

### Task 18: Scripts

- `scripts/discover-project-board.sh` — Board discovery helper
- `scripts/check-stop-sentinel.sh` — Check `.autopilot/stop` file
- `scripts/coverage-check.sh` — Verify coverage thresholds

---

### Task 19: Slash commands

**`commands/autopilot-build.md`** — Primary entry point (full lifecycle):
1. Read PRD at `$ARGUMENTS` path
2. Phase 0: prd-intake → clarification-engine → generate ADR
3. Phase 1: monorepo-scaffolding → service-scaffolding → ci-cd-generation
4. Phase 2: spec-decomposition → create GitHub issues
5. Phase 3: issue-lifecycle loop (with parallel dispatch for independent issues)
6. Phase 4: integration-qa
7. Phase 5: security-hardening → final-report

**`commands/autopilot.md`** — Backlog mode (existing repos):
1. project-board-discovery
2. Query backlog issues
3. Present to user, confirm selection
4. If `--parallel N`, invoke parallel-issue-dispatch
5. Otherwise, loop with issue-lifecycle

**`commands/autopilot-spec.md`** — Spec decomposition only:
1. Read spec at `$ARGUMENTS` path
2. spec-decomposition skill
3. After issues created, transition to backlog mode

**`commands/autopilot-suggest.md`** — Issue triage:
1. project-board-discovery → issue-triage → present recommendation

**`commands/autopilot-status.md`** — Board + session state display

**`commands/autopilot-resume.md`** — Resume from crash/stop:
1. Load `.autopilot/state.json`
2. Resume from last checkpoint phase/issue

**`commands/autopilot-stop.md`** — Create `.autopilot/stop` sentinel

---

### Task 20: README + registration

- Create git repo: `git init ~/repos/autopilot`, initial commit
- Create GitHub repo: `gh repo create brewinvaz/autopilot --public --source ~/repos/autopilot`
- Write `~/repos/autopilot/README.md` with usage examples for all commands
- Add plugin to `~/.claude/settings.json` `enabledPlugins` array
- Test end-to-end with WrapIQ

## Data Flow

```
/autopilot-build PRD.md --mockups ./mockups/
    │
    ▼
Phase 0: prd-intake → clarification-engine (3-pass) → ADR + services-map.json
    │
    ▼
Phase 1: monorepo-scaffolding → service-scaffolding → ci-cd-generation
    │
    ▼
Phase 2: spec-decomposition → GitHub issues on project board (Backlog)
    │
    ▼
Phase 3: issue-triage → [parallel?] → parallel-issue-dispatch | issue-lifecycle
    │                                    │
    │                              For each issue:
    │                              ├── "In progress" → worktree
    │                              ├── issue-implementer agent
    │                              ├── issue-reviewer agent (confidence ≥80)
    │                              ├── Push → PR → CI watch
    │                              ├── Merge → "Done" → checkpoint
    │                              └── Check stop sentinel
    │
    ▼
Phase 4: integration-qa → qa-agent → cross-service tests
    │
    ▼
Phase 5: security-hardening → final-report
```

## Commands Reference

| Command | Purpose | Phases |
|---------|---------|--------|
| `/autopilot-build PRD.md` | Full lifecycle from PRD | 0-5 |
| `/autopilot` | Backlog mode for existing repos | 3 only |
| `/autopilot-spec <path>` | Decompose spec into issues | 2 only |
| `/autopilot-suggest` | Triage and recommend next work | Analysis only |
| `/autopilot-status` | Show board + session state | Read-only |
| `/autopilot-resume` | Resume from crash/stop | Continues from checkpoint |
| `/autopilot-stop` | Graceful stop after current issue | Sets sentinel |
