/**
 * Static guard (HOS-1985): every service an admin route lists through the
 * inherited `BaseCrudService.adminList` must configure `adminSearchSchema`.
 *
 * Without it `adminList` answers 500 `CONFIGURATION_ERROR` ("adminSearchSchema
 * is not configured for <entity>") at request time. That happened on
 * `GET /admin/content-moderation/terms` and was invisible to every test that
 * mocked the service. This guard turns the same hole into a CI failure.
 *
 * How it works: scan `apps/api/src/routes` for `<receiver>.adminList(`, resolve
 * the receiver to the service class it was built from (`const x = new FooService(`),
 * then read that class in `@repo/service-core` and require `adminSearchSchema`
 * on it or on a service class it extends. Services that do not extend
 * `BaseCrudService` define their own `adminList` and are out of scope.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(import.meta.dirname, '../../src/routes');
const SERVICES_DIR = join(import.meta.dirname, '../../../../packages/service-core/src/services');

/** Recursively lists `.ts` files under a directory. */
function listTsFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return listTsFiles(full);
        return entry.name.endsWith('.ts') ? [full] : [];
    });
}

const serviceSources = listTsFiles(SERVICES_DIR).map((file) => ({
    file,
    source: readFileSync(file, 'utf8')
}));

/** Finds the source file declaring `export class <name>`. */
function findClassSource(name: string): string | undefined {
    const decl = new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${name}\\b`);
    return serviceSources.find(({ source }) => decl.test(source))?.source;
}

/** Strips line and block comments so a docblock mentioning the field is not a hit. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

type Verdict = 'configured' | 'missing' | 'out-of-scope';

/** Returns the source of the class body starting at its declaration (to the end of the file). */
function classBody(source: string, name: string): string | undefined {
    const start = source.search(new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${name}\\b`));
    if (start < 0) return undefined;
    const rest = source.slice(start);
    // Cut at the next top-level class declaration so a sibling class in the same file
    // cannot satisfy this one.
    const next = rest.slice(1).search(/\nexport\s+(?:abstract\s+)?class\s/);
    return next < 0 ? rest : rest.slice(0, next + 1);
}

/** Walks the `extends` chain of a service class looking for `adminSearchSchema`. */
function classVerdict(name: string, seen = new Set<string>()): Verdict {
    if (seen.has(name)) return 'out-of-scope';
    seen.add(name);
    const source = findClassSource(name);
    if (!source) return 'out-of-scope';
    const code = classBody(stripComments(source), name);
    if (!code) return 'out-of-scope';
    const parent = new RegExp(`class\\s+${name}\\b[^{]*?extends\\s+(\\w+)`).exec(code)?.[1];
    if (/adminSearchSchema\s*[=:]/.test(code)) return 'configured';
    if (parent === 'BaseCrudService' || parent === 'BaseCrudRelatedService') return 'missing';
    if (parent) return classVerdict(parent, seen);
    return 'out-of-scope';
}

/**
 * Receivers that legitimately do NOT use the inherited `BaseCrudService.adminList`:
 * the service defines its own `adminList` (it does not extend `BaseCrudService`).
 * Keyed `<routes-relative file>#<receiver>`. The guard also asserts each entry still
 * resolves to a class outside the BaseCrud hierarchy, so an entry cannot hide a
 * CRUD service.
 */
const OWN_ADMIN_LIST: Readonly<Record<string, { serviceClass: string; reason: string }>> = {
    'newsletter/admin/subscribers.ts#getDefaultNewsletterService': {
        serviceClass: 'NewsletterSubscriberService',
        reason: 'extends BaseService and implements its own adminList (typed Drizzle query)'
    },
    'feature-flags/admin/list.ts#featureFlagService': {
        serviceClass: 'FeatureFlagService',
        reason: 'plain class with its own adminList over FeatureFlagModel'
    }
};

/**
 * Resolves `receiver` to the service class it was built from: a `new X(` in the
 * route file itself, or in the relative module it is imported from (singletons).
 */
function resolveServiceClass(code: string, file: string, receiver: string): string | undefined {
    const construct = new RegExp(`\\b${receiver}\\s*=\\s*new\\s+(\\w+)\\s*\\(`);
    const local = construct.exec(code)?.[1];
    if (local) return local;
    const imported = new RegExp(
        `import\\s*\\{[^}]*\\b${receiver}\\b[^}]*\\}\\s*from\\s*'(\\.[^']+)'`
    ).exec(code)?.[1];
    if (!imported) return undefined;
    const base = resolve(dirname(file), imported.replace(/\.js$/, ''));
    for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
        try {
            return construct.exec(readFileSync(candidate, 'utf8'))?.[1];
        } catch {
            // try the next candidate
        }
    }
    return undefined;
}

interface AdminListCall {
    readonly file: string;
    readonly receiver: string;
    readonly serviceClass: string | undefined;
    readonly allowlisted: boolean;
}

/** Collects every `<receiver>.adminList(` and `<factory>().adminList(` call in the routes tree. */
function collectAdminListCalls(): AdminListCall[] {
    const calls: AdminListCall[] = [];
    for (const file of listTsFiles(ROUTES_DIR)) {
        const code = stripComments(readFileSync(file, 'utf8'));
        const rel = file.slice(ROUTES_DIR.length + 1);
        for (const match of code.matchAll(/(?:(\w+)|(\w+)\(\s*\))\s*\.adminList\(/g)) {
            const receiver = (match[1] ?? match[2]) as string;
            const allow = OWN_ADMIN_LIST[`${rel}#${receiver}`];
            calls.push({
                file: rel,
                receiver,
                serviceClass: allow?.serviceClass ?? resolveServiceClass(code, file, receiver),
                allowlisted: Boolean(allow)
            });
        }
    }
    return calls;
}

describe('admin list routes: adminSearchSchema is configured (HOS-1985)', () => {
    const calls = collectAdminListCalls();

    it('discovers the admin routes that call adminList', () => {
        expect(calls.length).toBeGreaterThan(20);
    });

    it('sees the call-expression receiver form (newsletter subscribers)', () => {
        expect(calls.some((c) => c.receiver === 'getDefaultNewsletterService')).toBe(true);
    });

    it('resolves every receiver to a service class, or allowlists it with a reason', () => {
        const unresolved = calls
            .filter(({ serviceClass }) => !serviceClass)
            .map(({ file, receiver }) => `${file} (${receiver})`);
        expect(unresolved).toEqual([]);
    });

    it('every allowlisted entry still points at a class outside the BaseCrud hierarchy', () => {
        const stale = Object.entries(OWN_ADMIN_LIST)
            .filter(([, { serviceClass }]) => classVerdict(serviceClass) !== 'out-of-scope')
            .map(([key]) => key);
        expect(stale).toEqual([]);
        for (const key of Object.keys(OWN_ADMIN_LIST)) {
            expect(calls.some((c) => `${c.file}#${c.receiver}` === key)).toBe(true);
        }
    });

    it('every BaseCrudService used through adminList declares adminSearchSchema', () => {
        const offenders = calls
            .filter(({ serviceClass }) => serviceClass && classVerdict(serviceClass) === 'missing')
            .map(({ file, serviceClass }) => `${file}: ${serviceClass} has no adminSearchSchema`);
        expect(offenders).toEqual([]);
    });

    describe('classVerdict on fixtures', () => {
        it('flags a CRUD service without the field (negative control)', () => {
            // SponsorshipLevelService extends BaseCrudService and is listed through `list`,
            // so it has no adminSearchSchema. If someone adds one, replace this fixture.
            expect(findClassSource('SponsorshipLevelService')).toBeDefined();
            expect(classVerdict('SponsorshipLevelService')).toBe('missing');
        });

        it('accepts a configured service (positive control)', () => {
            expect(classVerdict('ContentModerationTermService')).toBe('configured');
        });
    });
});
