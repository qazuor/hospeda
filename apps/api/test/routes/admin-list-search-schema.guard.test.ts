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
import { join } from 'node:path';
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

/** Walks the `extends` chain of a service class looking for `adminSearchSchema`. */
function classVerdict(name: string, seen = new Set<string>()): Verdict {
    if (seen.has(name)) return 'out-of-scope';
    seen.add(name);
    const source = findClassSource(name);
    if (!source) return 'out-of-scope';
    const code = stripComments(source);
    const header = new RegExp(`class\\s+${name}\\b[^{]*?extends\\s+(\\w+)`).exec(code);
    const parent = header?.[1];
    const isCrud = parent === 'BaseCrudService' || parent === 'BaseCrudRelatedService';
    const declaresSchema = /adminSearchSchema\s*[=:]/.test(code);
    if (declaresSchema) return 'configured';
    if (isCrud) return 'missing';
    if (parent) return classVerdict(parent, seen);
    return 'out-of-scope';
}

interface AdminListCall {
    readonly file: string;
    readonly receiver: string;
    readonly serviceClass: string | undefined;
}

/** Collects every `<receiver>.adminList(` call in the routes tree. */
function collectAdminListCalls(): AdminListCall[] {
    const calls: AdminListCall[] = [];
    for (const file of listTsFiles(ROUTES_DIR)) {
        const code = stripComments(readFileSync(file, 'utf8'));
        for (const match of code.matchAll(/(\w+)\.adminList\(/g)) {
            const receiver = match[1] as string;
            const built = new RegExp(`\\b${receiver}\\s*=\\s*new\\s+(\\w+)\\s*\\(`).exec(code);
            calls.push({
                file: file.slice(ROUTES_DIR.length + 1),
                receiver,
                // Fallback for injected singletons: `qrCodeService` -> `QrCodeService`.
                serviceClass: built?.[1] ?? receiver.charAt(0).toUpperCase() + receiver.slice(1)
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

    it('resolves every receiver to a service class', () => {
        const unresolved = calls
            .filter(({ serviceClass }) => !serviceClass)
            .map(({ file, receiver }) => `${file} (${receiver})`);
        expect(unresolved).toEqual([]);
    });

    it('every BaseCrudService used through adminList declares adminSearchSchema', () => {
        const offenders = calls
            .filter(({ serviceClass }) => serviceClass && classVerdict(serviceClass) === 'missing')
            .map(({ file, serviceClass }) => `${file}: ${serviceClass} has no adminSearchSchema`);
        expect(offenders).toEqual([]);
    });

    it('classVerdict flags a CRUD service without the field (negative control)', () => {
        // ExchangeRateService extends BaseCrudService and is never listed via adminList,
        // so it has no schema: the walker must report it as missing.
        expect(classVerdict('ExchangeRateService')).toBe('missing');
    });

    it('classVerdict accepts a configured service (positive control)', () => {
        expect(classVerdict('ContentModerationTermService')).toBe('configured');
    });
});
