#!/bin/bash
# Ralph Pipeline — builds one feature from the TaskFlow backlog
#
# Usage:
#   bash ralph.sh              # auto mode — runs end-to-end
#   bash ralph.sh --step       # step mode — pauses between phases
#
# Env overrides:
#   TASKFLOW_DIR   default ../taskflow
#   MAX_UNITS      default 1 (bump to build multiple units in one run)

set -euo pipefail

TASKFLOW_DIR="${TASKFLOW_DIR:-../taskflow}"
MAX_UNITS="${MAX_UNITS:-1}"
MAX_IMPL_ITERATIONS="${MAX_IMPL_ITERATIONS:-20}"

STEP_MODE=false
[ "${1:-}" = "--step" ] && STEP_MODE=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$TASKFLOW_DIR"

# Ensure prompts/ inside taskflow points at the ralph folder, so the prompts
# can reference paths like "prompts/AGENT.md" regardless of where ralph lives.
if [ ! -e prompts ]; then
  ln -s "$SCRIPT_DIR" prompts
fi

pause_if_step() {
  if [ "$STEP_MODE" = true ]; then
    echo ""
    echo ">>> PAUSED: $1"
    echo "    Review output, then press Enter to continue (Ctrl+C to stop)"
    read -r
  fi
}

run_claude() {
  cat "$1" | claude -p --dangerously-skip-permissions 2>&1
}

run_gates() {
  # Cheapest first. Writes .last-test-result on failure and returns non-zero.
  # Remove any stale failure file so its absence is a reliable "all passed" signal.
  rm -f .last-test-result
  if ! npm run lint --silent 2>&1; then
    echo "FAIL: ESLint"
    npm run lint > .last-test-result 2>&1 || true
    return 1
  fi
  if ! npm test --silent 2>&1; then
    echo "FAIL: Jest"
    npm test > .last-test-result 2>&1 || true
    return 1
  fi
  if ! npm run test:e2e --silent 2>&1; then
    echo "FAIL: Playwright"
    npm run test:e2e > .last-test-result 2>&1 || true
    return 1
  fi
  return 0
}

echo "========================================"
echo "  Ralph Pipeline"
echo "  Mode:         $([ "$STEP_MODE" = true ] && echo 'STEP' || echo 'AUTO')"
echo "  Taskflow dir: $TASKFLOW_DIR"
echo "  Max units:    $MAX_UNITS"
echo "  Gates:        ESLint → Jest → Playwright"
echo "========================================"

UNITS_BUILT=0
while [ $UNITS_BUILT -lt $MAX_UNITS ]; do

  # Match bold status lines (e.g. **DEFERRED — backlog | ...) — not changelog prose.
  if ! grep -qE '^\*\*DEFERRED' requirements/backlog.md 2>/dev/null; then
    echo ""
    echo "=== No DEFERRED units remain. Done. ==="
    break
  fi

  UNITS_BUILT=$((UNITS_BUILT + 1))
  echo ""
  echo "========================================"
  echo "  UNIT $UNITS_BUILT — Planning"
  echo "========================================"

  rm -f .ralph-active-plan
  run_claude "$SCRIPT_DIR/plan.md"
  pause_if_step "Planning done. Inspect docs/specs/, docs/architecture/, docs/plans/"

  echo ""
  echo "--- Generating failing tests ---"
  run_claude "$SCRIPT_DIR/generate-tests.md"
  git add -A && git commit -m "test: add failing tests for unit $UNITS_BUILT" || true
  pause_if_step "Tests generated. Run 'npm test && npm run test:e2e' — new tests should fail"

  # The planning step wrote the active plan path to .ralph-active-plan.
  if [ ! -s .ralph-active-plan ]; then
    echo "ERROR: .ralph-active-plan not written by planning step"
    exit 1
  fi
  PLAN_FILE=$(tr -d '[:space:]' < .ralph-active-plan)
  if [ ! -f "$PLAN_FILE" ]; then
    echo "ERROR: plan file '$PLAN_FILE' (from .ralph-active-plan) not found"
    exit 1
  fi
  echo "Plan file: $PLAN_FILE"

  echo ""
  echo "========================================"
  echo "  UNIT $UNITS_BUILT — Implementation Loop"
  echo "========================================"

  UNIT_DONE=false
  ITERATION=0
  while [ $ITERATION -lt $MAX_IMPL_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    echo ""
    echo "--- Iteration $ITERATION / $MAX_IMPL_ITERATIONS ---"

    run_claude "$SCRIPT_DIR/PROMPT.md"

    if ! run_gates; then
      echo "Gates failed. Retrying..."
      pause_if_step "Gate failed. Inspect .last-test-result"
      continue
    fi

    echo "ALL GATES PASSED"
    git add -A && git commit -m "feat: unit $UNITS_BUILT iteration $ITERATION" || true

    if ! grep -q '\- \[ \]' "$PLAN_FILE" 2>/dev/null; then
      echo ""
      echo "=== Unit $UNITS_BUILT complete ==="
      UNIT_DONE=true
      # Mark the active unit COMPLETE in the backlog
      ACTIVE_UNIT=$(basename "$PLAN_FILE" .md)
      sed -i "0,/^\*\*DEFERRED/s/^\*\*DEFERRED/**COMPLETE/" requirements/backlog.md
      git add requirements/backlog.md && git commit -m "chore: mark ${ACTIVE_UNIT} COMPLETE" || true
      pause_if_step "Unit $UNITS_BUILT done. Inspect backlog, AGENT.md, test results"
      break
    fi

    echo "Items remain in plan. Continuing..."
    pause_if_step "Iteration $ITERATION done. Inspect plan file and AGENT.md"
  done

  if [ "$UNIT_DONE" = false ]; then
    echo "=== Max iterations reached for unit $UNITS_BUILT. Stopping. ==="
    exit 1
  fi

done

echo ""
echo "========================================"
echo "  Pipeline finished — $UNITS_BUILT unit(s) built"
echo "========================================"
