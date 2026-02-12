---
version: "1.0"
total_signs: 4
---

# Guardrails

Learned constraints for autonomous task execution. Signs are append-only: add new signs as you learn, never remove existing ones.

## Signs

- **GR-001**: Verify before complete .. Always run quality gates (lint, typecheck, tests) before marking a task as done. Never skip quality checks even if the change seems trivial.

- **GR-002**: Check all tasks .. Before starting work, verify `index.json` and the relevant `state.json` are consistent. If counts do not match or statuses are stale, fix them before proceeding.

- **GR-003**: Document learnings .. When completing a phase boundary, update progress notes or create a diary entry. Capture what worked, what did not, and any decisions made during the phase.

- **GR-004**: Small focused changes .. Each task should touch a limited number of files. If a task requires modifying more than 10 files, consider splitting it. Keep commits atomic and focused on a single concern.
