#!/usr/bin/env node
/**
 * Manually add a reference article from pasted text.
 *
 * Usage:
 *   node scripts/add_reference.js <slug> <title>
 *   Then paste the article text and press Ctrl+D when done.
 *
 * Example:
 *   node scripts/add_reference.js nyt-2023-04-thomas-gifts "Thomas Accepted Luxury Trips From Donor"
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const slug = process.argv[2];
const title = process.argv[3];

if (!slug || !title) {
  console.error('Usage: node scripts/add_reference.js <slug> "<title>"');
  process.exit(1);
}

const referenceDir = './data/reference';
mkdirSync(referenceDir, { recursive: true });

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const content = `${title.toUpperCase()}\n\n---\n\n${input.trim()}`;
  const filepath = join(referenceDir, `${slug}.txt`);
  writeFileSync(filepath, content, 'utf-8');
  console.log(`Saved: ${filepath} (${input.trim().length} chars)`);
});
