/** TEST:V5:26 — GUARD:G2 halves (a) and (b): the vertical context is declared and taken from the resource. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    CONFIG_TYPE_FILE,
    RESOLVER_FILE,
    run,
    UPLOAD_ENTITY_FILE
} from '../check-vertical-context';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MIDDLEWARE = 'apps/api/src/middlewares/listing-access.ts';
const UPDATE_ROUTE = 'apps/api/src/routes/accommodation/protected/update.ts';
const BROCHURE_ROUTE = 'apps/api/src/routes/experience/protected/brochure.ts';
const TREE_FILES = [
    'packages/verticals/src/authorization/listing-operation.ts',
    RESOLVER_FILE,
    CONFIG_TYPE_FILE,
    'packages/verticals/src/authorization/resource-vertical.ts',
    MIDDLEWARE,
    UPDATE_ROUTE,
    BROCHURE_ROUTE,
    UPLOAD_ENTITY_FILE
] as const;
const UPDATE_ACCESS =
    "listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT', idParam: 'id' }";
const REAL_REPO_TIMEOUT = 60_000;

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g2ab-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const file of TREE_FILES) write(root, file, readFileSync(path.join(ROOT, file), 'utf8'));
    return root;
}

function write(root: string, file: string, source: string): void {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
}

function mutate(root: string, file: string, from: string, to: string): void {
    const source = readFileSync(path.join(root, file), 'utf8');
    expect(source).toContain(from);
    writeFileSync(path.join(root, file), source.replace(from, to));
}

function runTree(root: string): { readonly exitCode: number; readonly output: string } {
    return run({ root, minScannedFiles: 1, minRouteConfigs: 1 });
}

function expectFailure(root: string, ...fragments: readonly string[]): string {
    const result = runTree(root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toMatch(/^FAIL GUARD:G2 \(a, b\): \d+ problems/);
    for (const fragment of fragments) expect(result.output).toContain(fragment);
    return result.output;
}

describe('TEST:V5:26 - G2 (a) and (b): the vertical context is declared and taken from the resource', () => {
    it(
        'accepts the real repository and the unmutated minimal tree',
        () => {
            const real = run();
            expect(real.exitCode).toBe(0);
            expect(real.output).toContain('OK GUARD:G2 (a, b):');
            expect(runTree(tempTree()).exitCode).toBe(0);
        },
        REAL_REPO_TIMEOUT
    );

    it('(a) fails when the vertical becomes optional in either signature (spec mutation)', () => {
        const config = tempTree();
        mutate(
            config,
            CONFIG_TYPE_FILE,
            'vertical: ListingVertical;',
            'vertical?: ListingVertical;'
        );
        expectFailure(config, 'G2 (a):', 'the signature of ListingAccessConfig');
        const resolver = tempTree();
        mutate(
            resolver,
            RESOLVER_FILE,
            'readonly vertical: string;',
            'readonly vertical?: string;'
        );
        expectFailure(resolver, 'G2 (a):', 'the signature of resolveListingAccess');
    });

    it('(a) fails when a route or the middleware call does not declare its vertical', () => {
        const route = tempTree();
        mutate(route, UPDATE_ROUTE, 'vertical: VerticalEnum.ACCOMMODATION, ', '');
        const output = expectFailure(
            route,
            'G2 (a):',
            'route-config does not declare its vertical context'
        );
        expect(output).toMatch(
            /G2 \(a\): apps\/api\/src\/routes\/accommodation\/protected\/update\.ts:\d+ /
        );
        const spread = tempTree();
        mutate(
            spread,
            UPDATE_ROUTE,
            UPDATE_ACCESS,
            "listingAccess: { ...BASE_ACCESS, operation: 'EDIT' }"
        );
        expectFailure(spread, 'G2 (a):', 'listingAccess hides its vertical behind spread');
        const middleware = tempTree();
        mutate(
            middleware,
            MIDDLEWARE,
            '        vertical: config.vertical,\n        declaredVertical',
            '        declaredVertical'
        );
        expectFailure(
            middleware,
            `G2 (a): ${MIDDLEWARE}:`,
            'resolver-call does not declare its vertical context'
        );
    });

    it('(b) fails when an operation on Partner presence takes the vertical from the request (spec mutation)', () => {
        const root = tempTree();
        write(
            root,
            'apps/api/src/routes/partners/protected/presence.ts',
            "import { VerticalEnum } from '@repo/schemas';\n" +
                "import { resolveResourceVertical } from '@repo/verticals';\n" +
                'export const probe = (body: { vertical: string }) =>\n' +
                '    resolveResourceVertical({ resourceVertical: body.vertical, declaredVertical: VerticalEnum.PARTNER });\n'
        );
        expectFailure(
            root,
            'G2 (b): apps/api/src/routes/partners/protected/presence.ts:4',
            'resolveResourceVertical takes its vertical from the request (body.vertical)'
        );
    });

    it('TEST:1813:8 AC:1:15 (b) fails on a request-read resolver vertical, a folder mismatch and a computed route vertical', () => {
        const middleware = tempTree();
        mutate(
            middleware,
            MIDDLEWARE,
            '        vertical: config.vertical,\n        declaredVertical',
            "        vertical: c.req.query('vertical') ?? config.vertical,\n        declaredVertical"
        );
        expectFailure(
            middleware,
            'G2 (b):',
            'resolveListingAccess takes its vertical from the request'
        );
        const folder = tempTree();
        mutate(
            folder,
            BROCHURE_ROUTE,
            'vertical: VerticalEnum.EXPERIENCE',
            'vertical: VerticalEnum.VENUE'
        );
        expectFailure(folder, 'G2 (b):', 'route under routes/experience declares vertical VENUE');
        const computed = tempTree();
        mutate(
            computed,
            UPDATE_ROUTE,
            'vertical: VerticalEnum.ACCOMMODATION',
            'vertical: pickVertical()'
        );
        expectFailure(computed, 'G2 (b):', 'listingAccess computes its vertical (pickVertical())');
    });

    it('TEST:1813:8 AC:1:15 rejects an experience context in a gastronomy route after the key rename', () => {
        const root = tempTree();
        write(
            root,
            'apps/api/src/routes/gastronomy/protected/example.ts',
            "export const route = { listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'READ' } };\n"
        );
        expectFailure(
            root,
            'G2 (b): apps/api/src/routes/gastronomy/protected/example.ts:',
            'route under routes/gastronomy declares vertical EXPERIENCE'
        );
    });

    it('accepts a resource-read vertical, a route outside the three folders and a bare resource step', () => {
        const root = tempTree();
        write(
            root,
            'packages/verticals/src/authorization/negatives.ts',
            'export const a = (args: { vertical: string }) => resolveResourceVertical({ resourceVertical: args.vertical });\n' +
                "export const b = (facts: { vertical: string }) => resolveListingAccess({ vertical: facts.vertical, operation: 'READ_OWN' });\n" +
                "export const c = (actorId: string, facts: null) => resolveResourceStep({ actorId, facts, operation: 'READ_OWN' });\n"
        );
        write(
            root,
            'apps/api/src/routes/media/x.ts',
            "export const route = { listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT' } };\n"
        );
        expect(runTree(root).exitCode).toBe(0);
    });

    it('TEST:1813:8 AC:1:15 TEST:M1682:5 (b3) fails when the listing media upload stops running the chain per vertical', () => {
        const computed = tempTree();
        mutate(
            computed,
            UPLOAD_ENTITY_FILE,
            'vertical: VerticalEnum.VENUE',
            'vertical: entityType as never'
        );
        expectFailure(
            computed,
            `G2 (b): ${UPLOAD_ENTITY_FILE}:`,
            'listingAccess computes its vertical (entityType as never)'
        );
        const undeclared = tempTree();
        mutate(undeclared, UPLOAD_ENTITY_FILE, 'vertical: VerticalEnum.VENUE, ', '');
        expectFailure(
            undeclared,
            `G2 (a): ${UPLOAD_ENTITY_FILE}:`,
            'route-config does not declare its vertical context'
        );
        const noExperience = tempTree();
        mutate(
            noExperience,
            UPLOAD_ENTITY_FILE,
            "listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'EDIT', idParam: 'id' }",
            "other: { operation: 'EDIT', idParam: 'id' }"
        );
        expectFailure(
            noExperience,
            `G2 (b): ${UPLOAD_ENTITY_FILE} declares no listingAccess site for VerticalEnum.EXPERIENCE`
        );
        const noCall = tempTree();
        mutate(noCall, UPLOAD_ENTITY_FILE, 'await enforceListingAccess({', 'await skipAccess({');
        expectFailure(noCall, `G2 (b): ${UPLOAD_ENTITY_FILE} does not call enforceListingAccess`);
        const noFile = tempTree();
        unlinkSync(path.join(noFile, UPLOAD_ENTITY_FILE));
        expectFailure(noFile, `G2 (b): cannot read ${UPLOAD_ENTITY_FILE}`);
    });

    it('fails closed without the config type, without a resolver call, or with too few routes', () => {
        const noConfig = tempTree();
        unlinkSync(path.join(noConfig, CONFIG_TYPE_FILE));
        expectFailure(noConfig, `G2 (a): cannot read ${CONFIG_TYPE_FILE}`);
        const noResolverCall = tempTree();
        unlinkSync(path.join(noResolverCall, MIDDLEWARE));
        expectFailure(noResolverCall, 'found no resolveListingAccess call');
        const few = run({ root: tempTree(), minScannedFiles: 1, minRouteConfigs: 999 });
        expect(few.exitCode).toBe(1);
        expect(few.output).toContain('expected at least 999');
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:vertical-context']).toBe('tsx scripts/check-vertical-context.ts');
        expect(scripts['check:guards']).toContain('pnpm check:vertical-context');
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toContain(
            'name: Check every domain operation declares its vertical and reads it from the resource (GUARD:G2 a, b)'
        );
        expect(guardsJob).toContain('run: pnpm check:vertical-context');
    });
});
