/**
 * @file old-billing-client-removed.guard.test.ts
 * @description TEST:B13a:23 (web half, AC:B13a:22) — the web's old billing
 * client is gone and nothing in `apps/web` calls it.
 *
 * ## What AC:B13a:22 asks, and how this proves it
 *
 * "The methods of `apps/web/src/lib/api` (`endpoints-protected` and the index)
 * that point at billing routes the API no longer registers are deleted, and
 * nothing in `apps/web` imports them." That is three facts, and each one is
 * asserted against the real files rather than against a list kept here:
 *
 * 1. **The API no longer registers them.** The old billing mounts are read out
 *    of `apps/api/src/routes/index.ts` and the user routes, so the set this
 *    guard forbids is tied to what U1 actually removed. If one of those routes
 *    came back, the web method would be legitimate again and this half fails
 *    first, naming the mount.
 * 2. **No `lib/api` method targets them.** Every `path:` template in
 *    `apps/web/src/lib/api` is resolved (`${PROTECTED}` / `${BASE}`) and matched
 *    against the old billing route shapes; a hit names file, line and route.
 * 3. **Nothing imports the old client.** No module under `apps/web/src` names
 *    `billingApi` or `plansApi`, or calls `getSubscription(`.
 *
 * The scanner is a pure function over `{ file, source }` so its predicate is
 * exercised on a planted violation (`billingApi.purchaseAddon`, the mutation
 * TEST:B13a:23 names) without touching the tree.
 *
 * ## What it does not claim
 *
 * The full "no client calls an unregistered route" guard — every route of
 * `apps/api`, every `fetch` literal, and the admin hooks — is AC:B13a:24
 * (`B13a.10`). This file is narrower on purpose: it covers the old billing
 * client of `lib/api`, which is what AC:B13a:22 removes.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(WEB_ROOT, '../..');
const WEB_SRC = join(WEB_ROOT, 'src');
const LIB_API = join(WEB_SRC, 'lib/api');
const API_ROUTES = join(REPO_ROOT, 'apps/api/src/routes');

/** The API mounts of the old billing that U1 removed. */
const OLD_BILLING_MOUNTS: readonly string[] = [
    '/api/v1/protected/billing',
    '/api/v1/public/billing',
    '/api/v1/public/plans'
];

/** Old billing reads that lived under the user routes (`/protected/users/me/*`). */
const OLD_USER_BILLING_PATHS: readonly string[] = ['/me/subscription', '/me/entitlements'];

/**
 * The route shapes of the old billing client, matched against a `path:`
 * template once `${PROTECTED}` and `${BASE}` are resolved.
 */
const OLD_BILLING_ROUTE = new RegExp(
    [
        '/api/v1/protected/billing(/|$)',
        '/api/v1/public/billing(/|$)',
        '/api/v1/public/plans(/|$|\\?)',
        '/api/v1/protected/plans(/|$|\\?)',
        '/api/v1/protected/users/me/(subscription|entitlements)(/|$|\\?)'
    ].join('|')
);

/** The old client's exported names, and the one method it added to `userApi`. */
const OLD_CLIENT_SYMBOL = /\b(billingApi|plansApi)\b|\bgetSubscription\s*\(/;

/** A source line that is prose about the old client rather than a use of it. */
const COMMENT_LINE = /^\s*(\*|\/\/|\/\*)/;

/**
 * The two template placeholders `lib/api` builds its paths from, spelled out of
 * parts so no string literal in this file carries a `$` + `{` sequence.
 */
const PROTECTED_TOKEN = ['$', '{PROTECTED}'].join('');
const BASE_TOKEN = ['$', '{BASE}'].join('');
const SLUG_TOKEN = ['$', '{slug}'].join('');

/** One offending line: where it is and what it names. */
interface Offence {
    readonly file: string;
    readonly line: number;
    readonly route: string;
}

/**
 * Find every `path:` template in a `lib/api` source that targets an old
 * billing route.
 *
 * @param input - `{ file, source }`: the file's repo-relative path and content.
 * @returns One offence per matching line, with the resolved route.
 */
function findOldBillingPaths(input: {
    readonly file: string;
    readonly source: string;
}): readonly Offence[] {
    const { file, source } = input;
    const offences: Offence[] = [];
    source.split('\n').forEach((text, index) => {
        if (COMMENT_LINE.test(text)) return;
        const match = text.match(/path:\s*`([^`]*)`/);
        if (!match?.[1]) return;
        const route = match[1]
            .replaceAll(PROTECTED_TOKEN, '/api/v1/protected')
            .replaceAll(BASE_TOKEN, '/api/v1/public');
        if (OLD_BILLING_ROUTE.test(route)) {
            offences.push({ file, line: index + 1, route });
        }
    });
    return offences;
}

/**
 * Find every use of the old client's symbols in a web source.
 *
 * @param input - `{ file, source }`: the file's repo-relative path and content.
 * @returns One offence per matching line, naming the symbol as `route`.
 */
function findOldClientUses(input: {
    readonly file: string;
    readonly source: string;
}): readonly Offence[] {
    const { file, source } = input;
    const offences: Offence[] = [];
    source.split('\n').forEach((text, index) => {
        if (COMMENT_LINE.test(text)) return;
        const match = text.match(OLD_CLIENT_SYMBOL);
        if (match) {
            offences.push({ file, line: index + 1, route: match[0].trim() });
        }
    });
    return offences;
}

/** Every `.ts`/`.tsx`/`.astro` file under a directory. */
function collectSources(dir: string): readonly string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return collectSources(full);
        return /\.(ts|tsx|astro)$/.test(name) ? [full] : [];
    });
}

const read = (file: string) => ({
    file: relative(REPO_ROOT, file),
    source: readFileSync(file, 'utf8')
});

const format = (offences: readonly Offence[]) =>
    offences.map(({ file, line, route }) => `${file}:${line} → ${route}`).join('\n');

describe('TEST:B13a:23 — the API no longer registers the old billing routes', () => {
    const routesIndex = readFileSync(join(API_ROUTES, 'index.ts'), 'utf8');

    it.each(OLD_BILLING_MOUNTS)('apps/api mounts nothing at %s', (mount) => {
        expect(routesIndex).not.toContain(`'${mount}'`);
    });

    it.each(OLD_USER_BILLING_PATHS)('the user routes declare no %s path', (path) => {
        const userRoutes = collectSources(join(API_ROUTES, 'user'));
        expect(userRoutes.length).toBeGreaterThan(5);
        const declaring = userRoutes.filter((file) =>
            readFileSync(file, 'utf8').includes(`path: '${path}'`)
        );
        expect(declaring).toEqual([]);
    });

    it('reads the live route index — a mount that IS registered is found', () => {
        // Non-vacuity: a wrong path would make every negative above pass.
        expect(routesIndex).toContain("'/api/v1/protected/price-alerts'");
    });
});

describe('TEST:B13a:23 — no lib/api method targets an old billing route (AC:B13a:22)', () => {
    const libApiFiles = collectSources(LIB_API).map(read);

    it('scans the real client', () => {
        expect(libApiFiles.map(({ file }) => file)).toContain(
            'apps/web/src/lib/api/endpoints-protected.ts'
        );
        // The scanner resolves at least one live template, so it is reading paths.
        const liveTemplates = libApiFiles.flatMap(
            ({ source }) => source.match(/path:\s*`\$\{PROTECTED\}\/price-alerts`/g) ?? []
        );
        expect(liveTemplates.length).toBeGreaterThan(0);
    });

    it('finds no path template pointing at the old billing', () => {
        const offences = libApiFiles.flatMap(findOldBillingPaths);
        expect(offences, format(offences)).toEqual([]);
    });

    it('exports no old billing client from lib/api', () => {
        const offences = libApiFiles.flatMap(findOldClientUses);
        expect(offences, format(offences)).toEqual([]);
    });
});

describe('TEST:B13a:23 — nothing in apps/web imports the old billing client', () => {
    it('no web module names billingApi, plansApi or getSubscription', () => {
        const sources = collectSources(WEB_SRC).map(read);
        expect(sources.length).toBeGreaterThan(500);
        const offences = sources.flatMap(findOldClientUses);
        expect(offences, format(offences)).toEqual([]);
    });
});

describe('TEST:B13a:23 — the scanner catches a reintroduced old-billing call (mutation)', () => {
    const planted = {
        file: 'apps/web/src/components/planted.client.tsx',
        source: [
            "import { billingApi } from '@/lib/api/endpoints-protected';",
            '// billingApi in a comment is prose, not a call',
            'export async function buy(slug: string) {',
            '    return billingApi.purchaseAddon({ slug });',
            '}'
        ].join('\n')
    };
    const plantedClient = {
        file: 'apps/web/src/lib/api/endpoints-protected.ts',
        source: [
            'export const billingApi = {',
            '    purchaseAddon({ slug }: { readonly slug: string }) {',
            '        return apiClient.postProtected({',
            `            path: \`${PROTECTED_TOKEN}/billing/addons/${SLUG_TOKEN}/purchase\`,`,
            '        });',
            '    },',
            '    list() {',
            `        return apiClient.get({ path: \`${BASE_TOKEN}/plans\` });`,
            '    }',
            '};',
            `const ok = { path: \`${PROTECTED_TOKEN}/price-alerts\` };`
        ].join('\n')
    };

    it('names file, line and symbol for a reintroduced billingApi.purchaseAddon call', () => {
        expect(findOldClientUses(planted)).toEqual([
            { file: planted.file, line: 1, route: 'billingApi' },
            { file: planted.file, line: 4, route: 'billingApi' }
        ]);
    });

    it('names file, line and route for a reintroduced old billing path', () => {
        expect(findOldBillingPaths(plantedClient)).toEqual([
            {
                file: plantedClient.file,
                line: 4,
                route: `/api/v1/protected/billing/addons/${SLUG_TOKEN}/purchase`
            },
            { file: plantedClient.file, line: 8, route: '/api/v1/public/plans' }
        ]);
    });

    it('leaves a live route alone', () => {
        expect(
            findOldBillingPaths({
                file: 'x.ts',
                source: `const a = { path: \`${PROTECTED_TOKEN}/price-alerts\` };`
            })
        ).toEqual([]);
    });

    it('confirms the API routes directory exists, so the API half is not vacuous', () => {
        expect(existsSync(API_ROUTES)).toBe(true);
    });
});
