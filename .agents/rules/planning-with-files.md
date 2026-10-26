---
trigger: always_on
description: Persistent file-based planning using task_plan.md, findings.md, and progress.md for complex tasks.
---

## Planning with Files

For complex multi-step tasks (5+ tool calls or multi-phase implementations):
- Use the `planning-with-files` skill (`.agents/skills/planning-with-files/SKILL.md`).
- Maintain persistent disk-based planning files:
  - `task_plan.md` — for tracking phases, progress checklists, and architectural decisions.
  - `findings.md` — for research findings, API constraints, and discoveries.
  - `progress.md` — for incremental execution logs, test outcomes, and phase summaries.
- Apply the 2-Action Rule: persist findings after every 2 search/view operations.
- Apply the 3-Strike Error Protocol: after 3 consecutive failures on a phase, pause and reassess.
