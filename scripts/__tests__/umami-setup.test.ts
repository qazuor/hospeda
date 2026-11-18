import { describe, expect, it } from 'vitest';
import { listReferencedReportNames } from '../umami/boards.js';
import { buildReportDefinitions } from '../umami/definitions.js';
import { DRY_RUN_PLACEHOLDER_PREFIX, resolveSetupInput, runSetup } from '../umami/setup.js';
import {
    BOARD_COUNT,
    baseInput,
    COHORT_COUNT,
    FAKE_LOGIN,
    fakeUmami,
    REPORT_COUNT,
    SEGMENT_COUNT,
    TOKEN,
    WEBSITE,
    writes
} from './umami-fake.js';

describe('runSetup', () => {
    it('should create every report and board on the first run', async () => {
        const fake = fakeUmami();
        const { input } = baseInput({ fetchImpl: fake.fetchImpl });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(0);
        expect(result.reports).toEqual({ created: REPORT_COUNT, updated: 0, unchanged: 0 });
        expect(result.boards).toEqual({ created: BOARD_COUNT, updated: 0, unchanged: 0 });
        expect(fake.reports).toHaveLength(REPORT_COUNT);
        expect(fake.boards).toHaveLength(BOARD_COUNT);
        expect(result.segments).toEqual({ created: SEGMENT_COUNT, updated: 0, unchanged: 0 });
        expect(result.cohorts).toEqual({ created: COHORT_COUNT, updated: 0, unchanged: 0 });
        expect(fake.segments).toHaveLength(SEGMENT_COUNT + COHORT_COUNT);
    });

    it('should report everything unchanged and write nothing on the second run (AC-6)', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        fake.calls.length = 0;

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        expect(result.exitCode).toBe(0);
        expect(result.reports).toEqual({ created: 0, updated: 0, unchanged: REPORT_COUNT });
        expect(result.boards).toEqual({ created: 0, updated: 0, unchanged: BOARD_COUNT });
        expect(result.segments).toEqual({ created: 0, updated: 0, unchanged: SEGMENT_COUNT });
        expect(result.cohorts).toEqual({ created: 0, updated: 0, unchanged: COHORT_COUNT });
        expect(writes(fake.calls)).toEqual([]);
    });

    it('should make no writes in dry-run and still plan the boards with placeholders', async () => {
        const fake = fakeUmami();
        const { input, out } = baseInput({ fetchImpl: fake.fetchImpl, dryRun: true });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(0);
        expect(writes(fake.calls)).toEqual([]);
        expect(result.reports.created).toBe(REPORT_COUNT);
        expect(result.boards.created).toBe(BOARD_COUNT);
        expect(result.segments.created).toBe(SEGMENT_COUNT);
        expect(result.cohorts.created).toBe(COHORT_COUNT);
        expect(fake.segments).toEqual([]);
        expect(out.join('\n')).toContain('placeholder');
        expect(DRY_RUN_PLACEHOLDER_PREFIX.length).toBeGreaterThan(0);
    });

    it('should upsert every report before the first board', async () => {
        const fake = fakeUmami();

        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        const posts = writes(fake.calls).map((c) => c.path);
        const lastReport = posts.map((p) => p.startsWith('/api/reports')).lastIndexOf(true);
        const firstBoard = posts.findIndex((p) => p.startsWith('/api/boards'));
        expect(lastReport).toBeGreaterThanOrEqual(0);
        expect(firstBoard).toBeGreaterThan(lastReport);
    });

    it('should abort before any board when a report fails', async () => {
        const fake = fakeUmami({ failReportPosts: true });
        const { input, err } = baseInput({ fetchImpl: fake.fetchImpl });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(1);
        expect(fake.calls.some((c) => c.path.startsWith('/api/boards'))).toBe(false);
        expect(err.join('\n')).toContain('FAILED');
    });

    it('should never print the token or password', async () => {
        const failing = fakeUmami({ failReportPosts: true });
        const a = baseInput({ fetchImpl: failing.fetchImpl });
        await runSetup(a.input);
        const ok = fakeUmami();
        const b = baseInput({
            fetchImpl: ok.fetchImpl,
            credentials: { kind: 'login', username: 'admin', password: FAKE_LOGIN }
        });
        const loginResult = await runSetup(b.input);

        const text = [...a.out, ...a.err, ...b.out, ...b.err].join('\n');
        expect(loginResult.exitCode).toBe(0);
        expect(text).not.toContain(TOKEN);
        expect(text).not.toContain(FAKE_LOGIN);
        expect(a.err.join('\n')).toContain('[redacted]');
    });

    it('should fail with exit 1 when login is rejected', async () => {
        const fake = fakeUmami();
        const { input, err } = baseInput({
            fetchImpl: fake.fetchImpl,
            credentials: { kind: 'login', username: 'admin', password: 'wrong' }
        });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(1);
        expect(err.join('\n')).not.toContain('wrong');
    });

    it('should create only the new definition when one is added to the Umami state', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        const removed = fake.segments.findIndex((s) => s.name === 'Brasil y Uruguay');
        fake.segments.splice(removed, 1);
        fake.calls.length = 0;

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        expect(result.segments).toEqual({
            created: 1,
            updated: 0,
            unchanged: SEGMENT_COUNT - 1
        });
        expect(result.cohorts).toEqual({ created: 0, updated: 0, unchanged: COHORT_COUNT });
        expect(writes(fake.calls)).toEqual([
            { method: 'POST', path: `/api/websites/${WEBSITE}/segments` }
        ]);
    });

    it('should update in place, keeping the id, when stored parameters drift', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        const target = fake.segments.find((s) => s.name === 'Se registraron (30 días)');
        if (!target) throw new Error('fixture: cohort missing');
        const idBefore = target.id;
        target['parameters'] = {
            action: { type: 'event', value: 'sign_up_completed' },
            dateRange: '7day'
        };
        fake.calls.length = 0;

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        expect(result.cohorts).toEqual({ created: 0, updated: 1, unchanged: COHORT_COUNT - 1 });
        expect(writes(fake.calls)).toEqual([
            { method: 'POST', path: `/api/websites/${WEBSITE}/segments/${idBefore}` }
        ]);
        expect(target.id).toBe(idBefore);
        expect(target['parameters']).toEqual({
            action: { type: 'event', value: 'sign_up_completed' },
            dateRange: '30day'
        });
    });

    it('should list unmanaged items, never touch them, and never delete', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        fake.segments.push({
            id: 'hand-1',
            type: 'segment',
            name: 'Hecho a mano',
            parameters: { filters: [] }
        });
        fake.reports.push({
            id: 'hand-r',
            websiteId: WEBSITE,
            name: 'Reporte manual',
            type: 'goal',
            parameters: {}
        });
        const snapshot = JSON.stringify(fake.segments);
        fake.calls.length = 0;
        const { input, out } = baseInput({ fetchImpl: fake.fetchImpl });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(0);
        expect(result.unmanaged).toEqual([
            { kind: 'report', name: 'Reporte manual' },
            { kind: 'segment', name: 'Hecho a mano' }
        ]);
        expect(out.join('\n')).toContain('Unmanaged (left untouched)');
        expect(writes(fake.calls)).toEqual([]);
        expect(fake.calls.some((c) => c.method === 'DELETE')).toBe(false);
        expect(JSON.stringify(fake.segments)).toBe(snapshot);
    });

    it('should warn and exit 0 when listing unmanaged items fails after applying', async () => {
        // Each report upsert lists reports once; the next list is the unmanaged step.
        const fake = fakeUmami({ failReportListsAfter: REPORT_COUNT });
        const { input, out, err } = baseInput({ fetchImpl: fake.fetchImpl });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(0);
        expect(result.unmanaged).toEqual([]);
        expect(out.join('\n')).toContain('Warning: could not list unmanaged items');
        expect(out.join('\n')).not.toContain(TOKEN);
        expect(err.join('\n')).not.toContain('FAILED');
        expect(fake.reports).toHaveLength(REPORT_COUNT);
        expect(fake.boards).toHaveLength(BOARD_COUNT);
        expect(fake.segments).toHaveLength(SEGMENT_COUNT + COHORT_COUNT);
        expect(result.segments.created).toBe(SEGMENT_COUNT);
    });

    it('should leave the old item as unmanaged when a definition is renamed', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        const renamed = fake.segments.find((s) => s.name === 'Usuarios logueados');
        if (!renamed) throw new Error('fixture: segment missing');
        renamed.name = 'Nombre viejo';

        const result = await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);

        expect(result.segments.created).toBe(1);
        expect(result.unmanaged).toEqual([{ kind: 'segment', name: 'Nombre viejo' }]);
        expect(fake.segments.some((s) => s.name === 'Nombre viejo')).toBe(true);
    });

    it('should fail without writing when a segment name is ambiguous', async () => {
        const fake = fakeUmami();
        await runSetup(baseInput({ fetchImpl: fake.fetchImpl }).input);
        const original = fake.segments.find((s) => s.name === 'Celular y tablet');
        if (!original) throw new Error('fixture: segment missing');
        fake.segments.push({ ...original, id: 'dup-1' });
        fake.calls.length = 0;
        const { input, err } = baseInput({ fetchImpl: fake.fetchImpl });

        const result = await runSetup(input);

        expect(result.exitCode).toBe(1);
        expect(err.join('\n')).toContain('[ambiguous]');
        expect(writes(fake.calls)).toEqual([]);
    });

    it('should reference only reports that the setup upserts', () => {
        const names = new Set(buildReportDefinitions().map((r) => r.name));
        for (const name of listReferencedReportNames()) expect(names.has(name)).toBe(true);
    });
});

describe('resolveSetupInput', () => {
    const vars = {
        HOSPEDA_UMAMI_URL: 'http://u',
        HOSPEDA_UMAMI_WEBSITE_ID_WEB: 'w',
        UMAMI_SETUP_API_KEY: 'k'
    };

    it('should resolve a token config and the dry-run flag', () => {
        const r = resolveSetupInput({ argv: ['--dry-run'], vars });
        expect(r).toMatchObject({ ok: true, value: { dryRun: true, baseUrl: 'http://u' } });
    });

    it('should accept username and password as credentials', () => {
        const r = resolveSetupInput({
            argv: [],
            vars: {
                HOSPEDA_UMAMI_URL: 'http://u',
                HOSPEDA_UMAMI_WEBSITE_ID_WEB: 'w',
                UMAMI_SETUP_USERNAME: 'a',
                UMAMI_SETUP_PASSWORD: 'b'
            }
        });
        expect(r).toMatchObject({ ok: true, value: { credentials: { kind: 'login' } } });
    });

    it('should name every missing variable', () => {
        const r = resolveSetupInput({ argv: [], vars: {} });
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.message).toContain('HOSPEDA_UMAMI_URL');
            expect(r.message).toContain('HOSPEDA_UMAMI_WEBSITE_ID_WEB');
            expect(r.message).toContain('UMAMI_SETUP_API_KEY');
        }
    });

    it('should reject unknown arguments', () => {
        expect(resolveSetupInput({ argv: ['--yolo'], vars }).ok).toBe(false);
    });
});
