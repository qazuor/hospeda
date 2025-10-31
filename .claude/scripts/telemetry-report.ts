#!/usr/bin/env tsx
/**
 * Telemetry Report Generator (Simplified)
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TELEMETRY_PATH = resolve(process.cwd(), '.claude/.telemetry.json');

process.stdout.write('\n📈 Telemetry Report\n');
process.stdout.write('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

if (!existsSync(TELEMETRY_PATH)) {
  console.log('❌ No telemetry data found.');
  console.log('\n💡 Telemetry file: .claude/.telemetry.json');
  console.log('   This file is created automatically as you use the system.\n');
  process.exit(0);
}

try {
  const content = readFileSync(TELEMETRY_PATH, 'utf-8');
  const data = JSON.parse(content);

  console.log(`Version: ${data.version || 'unknown'}`);
  console.log(`Tracking since: ${data.createdAt || 'unknown'}`);
  console.log(`Last updated: ${data.lastUpdated || 'unknown'}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔒 Privacy Note: All telemetry data is stored locally');
  console.log('   and never transmitted. The .telemetry.json file is');
  console.log('   gitignored and remains on your machine.\n');
} catch (error) {
  console.error('Error loading telemetry:', error);
  process.exit(1);
}
