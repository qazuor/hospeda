import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findRawSqlSuccessionWrites,
    findSuccessionWrites,
    listProductionFiles
} from '../succession-writers-scan.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
describe('succession-writers-scan', () => {
    it('recognizes assignments and shorthand but ignores null, schema, signatures and reads', () => {
        const source = `type Row = { succeedsId: string | null };\nconst a = db.values({ succeedsId: x });\nconst b = db.set({ succeedsId });\nconst c = { 'succeeds_id': x };\nconst d = { succeedsId: null, other: undefined, schema: z.string().uuid().nullable() };\neq(t.succeedsId, x); isNull(t.succeedsId); row.succeedsId;`;
        expect(findSuccessionWrites({ file: 'a.ts', source }).map((w) => w.line)).toEqual([
            2, 3, 4
        ]);
    });
    it('does not treat a select/returning projection as a write, but still flags values/set (HOS-1681)', () => {
        const source = `const a = db.select({ succeedsId: t.succeedsId }).from(t);
const b = db.selectDistinct({ succeedsId: t.succeedsId }).from(t);
const c = db.update(t).set({ x: 1 }).returning({ succeedsId: t.succeedsId });
const d = db.insert(t).values({ succeedsId: x });
const e = db.update(t).set({ succeedsId: y });
const f = { succeedsId: z };`;
        expect(findSuccessionWrites({ file: 'a.ts', source }).map((w) => w.line)).toEqual([4, 5]);
    });
    it('recognizes raw SQL writes, not SELECT reads', () => {
        expect(
            findRawSqlSuccessionWrites({
                file: 'a.ts',
                source: "const q = 'INSERT INTO subscription (id, succeeds_id) VALUES ($1, $2)'; const r = `SELECT * FROM subscription WHERE succeeds_id = $1`;"
            })
        ).toHaveLength(1);
    });
    it('lists only production roots and excludes tests, schemas, migrations, billing', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'succ-scan-'));
        dirs.push(root);
        execFileSync('git', ['init', '-q'], { cwd: root });
        for (const file of [
            'apps/api/src/a.ts',
            'apps/api/src/a.test.ts',
            'packages/db/src/schemas/x.ts',
            'packages/db/src/migrations/x.ts',
            'packages/billing/src/x.ts',
            'packages/other/src/x.ts'
        ]) {
            const p = path.join(root, file);
            mkdirSync(path.dirname(p), { recursive: true });
            writeFileSync(p, '');
        }
        expect(listProductionFiles({ root })).toEqual([
            'apps/api/src/a.ts',
            'packages/other/src/x.ts'
        ]);
    });
});
