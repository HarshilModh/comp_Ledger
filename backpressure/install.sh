#!/bin/bash
# Wire the back-pressure stack (ESLint + Playwright) into a taskflow project.
# Idempotent — safe to run multiple times.
#
# Usage:
#   bash install.sh                   # installs into ../../taskflow
#   bash install.sh /path/to/taskflow # installs into a specific project

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$(cd "$SCRIPT_DIR/../../taskflow" && pwd)}"

if [ ! -f "$TARGET/package.json" ]; then
  echo "ERROR: $TARGET/package.json not found" >&2
  exit 1
fi

echo "Wiring back-pressure into $TARGET"

# 1. Copy config files (no clobber — manual copies win)
[ -f "$TARGET/.eslintrc.json" ]     || cp "$SCRIPT_DIR/.eslintrc.json"     "$TARGET/.eslintrc.json"
[ -f "$TARGET/playwright.config.js" ] || cp "$SCRIPT_DIR/playwright.config.js" "$TARGET/playwright.config.js"

# 2. Copy smoke test
mkdir -p "$TARGET/tests/e2e"
[ -f "$TARGET/tests/e2e/board.spec.js" ] || cp "$SCRIPT_DIR/tests/e2e/board.spec.js" "$TARGET/tests/e2e/board.spec.js"

# 3. Add scripts + devDependencies + jest ignore to package.json
node - "$TARGET/package.json" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));

pkg.scripts = pkg.scripts || {};
pkg.scripts.lint     = pkg.scripts.lint     || 'eslint src/';
pkg.scripts['test:e2e'] = pkg.scripts['test:e2e'] || 'playwright test';

pkg.devDependencies = pkg.devDependencies || {};
pkg.devDependencies.eslint           = pkg.devDependencies.eslint           || '^8.57.0';
pkg.devDependencies['@playwright/test'] = pkg.devDependencies['@playwright/test'] || '^1.48.0';

pkg.jest = pkg.jest || {};
const ignore = new Set(pkg.jest.testPathIgnorePatterns || ['/node_modules/']);
ignore.add('/tests/e2e/');
pkg.jest.testPathIgnorePatterns = [...ignore];

fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json updated');
NODE

# 4. Install deps + chromium (if not already done)
cd "$TARGET"
npm install
echo ""
echo "Downloading Chromium for Playwright (~180 MB, one-time)..."
npx --yes playwright install chromium

echo ""
echo "Installing Chromium system dependencies (libatk, libnss, etc.)..."
sudo npx --yes playwright install-deps chromium

echo ""
echo "Done. Verify with: npm run lint && npm test && npm run test:e2e"
