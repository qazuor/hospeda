import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { isServiceTestDbAvailable } from './helpers.js';
import { planSerialLocks } from './sweep-serial-groups.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const source = (name: string) => readFileSync(path.join(here, name), 'utf8');
describe('sweep serial lock planning', () => {
    it('plans complement pause as shared', () =>
        expect(planSerialLocks({ source: source('complement-pause-s32.test.ts') })).toEqual([
            { key: 1_999_001, mode: 'shared' }
        ]));
    it('keeps drivers exclusive and orders groups', () => {
        expect(planSerialLocks({ source: source('reconciliation-grant-fan-out.test.ts') })).toEqual(
            [{ key: 1_999_001, mode: 'exclusive' }]
        );
        expect(planSerialLocks({ source: 'runReconciliationSweep seedOrphanInstance(' })).toEqual([
            { key: 1_999_001, mode: 'exclusive' }
        ]);
        expect(planSerialLocks({ source: 'nothing relevant' })).toEqual([]);
        expect(planSerialLocks({ source: 'applyDueScheduledChanges seedOrphanInstance(' })).toEqual(
            [
                { key: 1_999_001, mode: 'shared' },
                { key: 1_999_002, mode: 'exclusive' }
            ]
        );
    });
    it('serializes every file that drives the A3 window pass (HOS-2179)', () => {
        for (const file of ['addon-a3-window.test.ts', 'addon-one-time-page.test.ts'])
            expect(
                planSerialLocks({ source: source(file) }).some(
                    ({ key, mode }) => key === 1_999_003 && mode === 'exclusive'
                ),
                file
            ).toBe(true);
        expect(planSerialLocks({ source: 'expireAddonAuthorizationWindowsX(' })).toEqual([]);
    });
    it('runs the global proposed-refund list alone against MARK_PROPOSAL writers (HOS-2406)', () => {
        expect(planSerialLocks({ source: source('list-proposed-refunds.test.ts') })).toContainEqual(
            {
                key: 1_999_004,
                mode: 'exclusive'
            }
        );
        for (const file of [
            'refund-settle-remainder-held.test.ts',
            'addon-one-time-page-held-refund-exits.test.ts'
        ])
            expect(planSerialLocks({ source: source(file) }), file).toContainEqual({
                key: 1_999_004,
                mode: 'shared'
            });
    });
    it('guards every transitive fixture victim', () => {
        const support = path.join(here, 'support');
        const files = readdirSync(support).filter((file) => file.endsWith('.ts'));
        const contents = new Map(
            files.map((file) => [file, readFileSync(path.join(support, file), 'utf8')])
        );
        const victims = new Set(
            files.filter((file) =>
                /seedOrphanInstance\(|insert\(addonInstances\)/.test(contents.get(file) ?? '')
            )
        );
        let changed = true;
        while (changed) {
            changed = false;
            for (const [file, text] of contents) {
                if (
                    !victims.has(file) &&
                    [...text.matchAll(/from ['"]\.\/([^'"]+)['"]/g)].some((m) =>
                        victims.has(`${(m[1] ?? '').replace(/\.js$/, '')}.ts`)
                    )
                ) {
                    victims.add(file);
                    changed = true;
                }
            }
        }
        const impacted = new Map<string, string>();
        for (const file of readdirSync(here).filter((f) => f.endsWith('.test.ts'))) {
            const text = source(file);
            // Exact import paths only: `provider-pause-fixtures` must not count as `pause-fixtures`.
            const imported = [...text.matchAll(/from ['"]\.\/support\/([^'"]+)['"]/g)].map(
                (m) => `${(m[1] ?? '').replace(/\.js$/, '')}.ts`
            );
            const module = imported.find((fixture) => victims.has(fixture));
            if (/seedOrphanInstance\(|insert\(addonInstances\)/.test(text) || module)
                impacted.set(file, module ?? 'direct addon instance token');
        }
        expect(impacted.size).toBeGreaterThan(20);
        expect(impacted.has('complement-pause-s32.test.ts')).toBe(true);
        for (const [file, module] of impacted)
            expect(
                planSerialLocks({ source: source(file) }).some(({ key }) => key === 1_999_001),
                `${file} is a victim via ${module}`
            ).toBe(true);
    });
    it.skipIf(!isServiceTestDbAvailable())(
        'enforces shared/exclusive advisory lock compatibility',
        async () => {
            const first = new Client({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL });
            const second = new Client({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL });
            const key = 1_777_233;
            let firstShared = false;
            let secondShared = false;
            try {
                await Promise.all([first.connect(), second.connect()]);
                firstShared = (
                    await first.query('SELECT pg_try_advisory_lock_shared($1) AS ok', [key])
                ).rows[0].ok;
                secondShared = (
                    await second.query('SELECT pg_try_advisory_lock_shared($1) AS ok', [key])
                ).rows[0].ok;
                expect(firstShared).toBe(true);
                expect(secondShared).toBe(true);
                expect(
                    (await second.query('SELECT pg_try_advisory_lock($1) AS ok', [key])).rows[0].ok
                ).toBe(false);
                await first.query('SELECT pg_advisory_unlock_shared($1)', [key]);
                firstShared = false;
                await second.query('SELECT pg_advisory_unlock_shared($1)', [key]);
                secondShared = false;
                const exclusive = (
                    await second.query('SELECT pg_try_advisory_lock($1) AS ok', [key])
                ).rows[0].ok;
                expect(exclusive).toBe(true);
                if (exclusive) await second.query('SELECT pg_advisory_unlock($1)', [key]);
            } finally {
                if (firstShared) await first.query('SELECT pg_advisory_unlock_shared($1)', [key]);
                if (secondShared) await second.query('SELECT pg_advisory_unlock_shared($1)', [key]);
                await Promise.all([first.end(), second.end()]);
            }
        }
    );
});
