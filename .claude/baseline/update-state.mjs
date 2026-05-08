import { readFileSync, writeFileSync } from 'node:fs';

const path =
    '/home/qazuor/projects/WEBS/hospeda-home-audit/.claude/tasks/SPEC-099-home-audit-remediation/state.json';
const state = JSON.parse(readFileSync(path, 'utf8'));
const now = new Date().toISOString();
const ids = ['T-001', 'T-002', 'T-003', 'T-004'];
let changed = 0;
for (const t of state.tasks) {
    if (ids.includes(t.id)) {
        t.status = 'completed';
        t.timestamps = t.timestamps || {};
        t.timestamps.completed = now;
        if (!t.timestamps.created) t.timestamps.created = '2026-05-07T00:00:00.000Z';
        changed++;
    }
}
state.summary.completed = 4;
state.summary.pending = 88;
writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Updated ${changed} tasks. completed=${state.summary.completed} pending=${state.summary.pending}`);
