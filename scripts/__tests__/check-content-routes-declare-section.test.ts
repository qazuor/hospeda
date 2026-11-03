import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { INVENTORY_FILE, run } from '../check-content-routes-declare-section';

const ROOT = path.resolve(import.meta.dirname, '../..');
const INVENTORY = JSON.parse(readFileSync(path.join(ROOT, INVENTORY_FILE), 'utf8')) as Record<
    string,
    { section: string; intent: string }
>;
const ROUTE = 'apps/api/src/routes/venue/protected/putDailySpecials.ts';
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tree() {
    const root = mkdtempSync(path.join(tmpdir(), 'gfac06-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    write(root, INVENTORY_FILE, JSON.stringify(INVENTORY));
    for (const file of Object.keys(INVENTORY))
        write(root, file, readFileSync(path.join(ROOT, file), 'utf8'));
    return root;
}
function write(root: string, file: string, source: string) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
}
function mutate(root: string, file: string, from: string, to: string) {
    const p = path.join(root, file);
    const s = readFileSync(p, 'utf8');
    expect(s).toContain(from);
    writeFileSync(p, s.replace(from, to));
}

describe('TEST:3.4:3 — GUARD:G-FAC-06 content routes declare their section', () => {
    it('accepts the repository inventory', () => {
        expect(run().exitCode).toBe(0);
    });
    it('fails when a route omits listingSection', () => {
        const r = tree();
        mutate(r, ROUTE, "id: 'dailySpecials',", '');
        expect(run({ root: r, minRoutes: 1 }).output).toContain(
            'must declare section dailySpecials'
        );
    });
    it('fails when a newly added route touches a content table without joining the inventory', () => {
        const r = tree();
        write(
            r,
            'apps/api/src/routes/venue/protected/newDailyRoute.ts',
            "import { getVenueDailySpecials } from '@repo/service-core';\ngetVenueDailySpecials(model, args);\n"
        );
        expect(run({ root: r, minRoutes: 1 }).output).toContain(
            'missing from the closed inventory'
        );
    });
    it('fails when a route declares a common section instead of its own', () => {
        const r = tree();
        mutate(r, ROUTE, "id: 'dailySpecials',", "id: 'common',");
        expect(run({ root: r, minRoutes: 1 }).output).toContain('common section');
    });
    it('fails when a section declaration bypasses the chain', () => {
        const r = tree();
        mutate(r, ROUTE, '= createProtectedRoute(', '= createCRUDRoute(');
        expect(run({ root: r, minRoutes: 1 }).output).toContain(
            'does not use the listingAccess chain'
        );
    });
    it('fails when a delete route declares write intent', () => {
        const r = tree();
        mutate(
            r,
            'apps/api/src/routes/venue/protected/deleteMenuFile.ts',
            "intent: 'delete'",
            "intent: 'write'"
        );
        expect(run({ root: r, minRoutes: 1 }).output).toContain('must declare intent delete');
    });
    it('fails when a body-empty replacement no longer distinguishes delete intent', () => {
        const r = tree();
        mutate(
            r,
            ROUTE,
            "Array.isArray(body?.specials) && body.specials.length === 0 ? 'delete' : 'write'",
            "'write'"
        );
        expect(run({ root: r, minRoutes: 1 }).output).toContain(
            'must distinguish write and delete intent'
        );
    });
});
