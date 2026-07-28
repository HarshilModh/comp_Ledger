Read `CLAUDE.md` to find the active unit. Read its spec and architecture files. Read existing test files to follow the established pattern.

First check whether test files for this unit already exist:
- `src/__tests__/{unit}.test.js` (Jest)
- `tests/e2e/{unit}.spec.js` (Playwright)

If the file already exists and covers all ACs in the spec, output a brief summary of what you found. Then read the plan file (path is in `.ralph-active-plan`) and check off every plan item whose work is already done by the existing test file — do not leave items unchecked that describe tests already written.

Otherwise generate tests for every acceptance criterion in the spec:
- API / backend ACs → `src/__tests__/{unit}.test.js` (Jest)
- UI ACs → `tests/e2e/{unit}.spec.js` (Playwright)

Rules:
- Generate test files only. Do not modify `src/` or `public/`.
- New tests must FAIL (nothing is implemented yet).
- Existing tests must still PASS.
