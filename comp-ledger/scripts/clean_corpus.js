#!/usr/bin/env node
import { readdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const dirs = ['./data/publisher', './data/reference'];

for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith('.txt'));
  for (const f of files) {
    unlinkSync(join(dir, f));
  }
  console.log(`Cleaned ${dir}: removed ${files.length} files`);
}

if (existsSync('./data/index.json')) {
  unlinkSync('./data/index.json');
  console.log('Removed old index.json');
}
