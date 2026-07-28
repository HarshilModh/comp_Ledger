You are implementing a feature for TaskFlow.

Read `CLAUDE.md` to find the active unit and its plan file. Read the plan file and `prompts/AGENT.md`.

Find the FIRST unchecked item (`- [ ]`) in the plan file. Implement **only that item**.

Then:
1. Mark the item as done (`- [x]`) in the plan file.
2. Append anything newly learned about the project, build, or test pattern to `prompts/AGENT.md` under the "Learned" section.

Rules:
- Tests under `tests/` are frozen. Do NOT modify them.
- One item per iteration. Do not look ahead.
- Do NOT run lint or tests yourself — the orchestrator runs them after you exit. Your authority is implementation; the script's authority is pass/fail.
- Do NOT commit — the orchestrator commits after gates pass.
- If you cannot complete the item within its scope, write the obstacle to `.last-test-result` and stop.

**Verification and completion steps:** If the current item says "verify tests pass", "run tests", or "update backlog to COMPLETE", you MUST first check whether `.last-test-result` exists. The orchestrator deletes this file when gates pass and writes it when they fail — so its presence or absence is the definitive signal:
- File **absent**: gates passed on the previous iteration. Mark the item done and continue.
- File **exists**: gates failed. Do NOT mark the item done. Read the file, find and fix the root cause of the failures as your work for this iteration, then stop (without checking off the item).
