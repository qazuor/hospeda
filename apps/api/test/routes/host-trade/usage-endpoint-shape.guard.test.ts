/**
 * Static guard on the shape of the HOS-376 usage endpoints (T-061).
 *
 * Two properties the request-level suites structurally cannot assert, because
 * they build a bare Hono app and inject the actor themselves:
 *
 * 1. **The 401 comes from the factory, not from the handler.** Asserting
 *    "no session → 401" against a harness that installs its own actor
 *    middleware would only prove the harness. What actually produces the 401 in
 *    production is being built by `createProtected*`, so that is what is
 *    checked here.
 *
 * 2. **The three shared transitions must carry NO `requiredPermissions`.** This
 *    is an ABSENCE, and an absence cannot be observed from a response: a
 *    request that succeeds proves the caller had whatever was required, not
 *    that nothing was. The cost of getting it wrong is specific — a permission
 *    here turns every refusal for a non-holder from 404 into 403, and a 403 on
 *    `/usages/{id}/confirm` confirms that the id exists. That is precisely the
 *    oracle §6.2 and AC-6 are written to prevent.
 *
 * `docs/billing/endpoint-gate-matrix.md` already records both facts in prose,
 * and its snapshot guard checks that every handler file has a row — but not
 * what the row SAYS. A permission added to a transition route would keep that
 * guard green.
 *
 * Nothing here strips comments. Every check runs against the object literal
 * passed to the factory, located by brace matching, so a `requiredPermissions`
 * mentioned in a JSDoc paragraph is never mistaken for a declared one.
 *
 * @module test/routes/host-trade/usage-endpoint-shape.guard
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(process.cwd(), 'src/routes/host-trade/protected');

/** The HOS-376 usage surface: T-030 (host), T-031 (provider), T-033 (shared). */
const USAGE_ROUTE_FILES = ['usages.ts', 'mine-usages.ts', 'usage-transitions.ts'] as const;

/** The three role-blind transitions, which must stay permission-free. */
const TRANSITION_ROUTES = [
    'protectedConfirmUsageRoute',
    'protectedRejectUsageRoute',
    'protectedUndoRejectionRoute'
] as const;

interface RouteDeclaration {
    /** The exported const name. */
    readonly name: string;
    /** The factory it was built with, e.g. `createProtectedRoute`. */
    readonly factory: string;
    /** The literal source of the single object argument, braces included. */
    readonly config: string;
}

/**
 * Extracts every `export const X = someFactory({...})` from a route file.
 *
 * The config is delimited by brace matching rather than a regex, so a nested
 * object (`options`, `requestParams`) cannot truncate it early and make a
 * missing key look absent when it is merely below the cut.
 */
function parseRouteDeclarations(source: string): RouteDeclaration[] {
    const declarations: RouteDeclaration[] = [];
    const header = /export const (\w+) = (\w+)\(\{/g;

    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: the exec/assign idiom is how a /g regex is iterated
    while ((match = header.exec(source)) !== null) {
        const open = source.indexOf('{', match.index);
        let depth = 0;
        let end = -1;
        for (let i = open; i < source.length; i++) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}') {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end === -1) {
            throw new Error(`Unbalanced braces in the config of ${match[1]}`);
        }
        declarations.push({
            name: match[1] as string,
            factory: match[2] as string,
            config: source.slice(open, end + 1)
        });
    }
    return declarations;
}

/**
 * Whether the config DECLARES the key, as opposed to mentioning it in prose.
 *
 * A declared key starts its own line after indentation; a JSDoc mention is
 * always preceded by the block's ` * `. Matching on that shape is why this
 * guard never has to remove comments — and removing them is how a guard ends
 * up deleting the code it was meant to inspect.
 */
function declaresKey(config: string, key: string): boolean {
    return new RegExp(`^[ \\t]*${key}\\s*:`, 'm').test(config);
}

function loadRoutes(file: string): RouteDeclaration[] {
    return parseRouteDeclarations(readFileSync(join(ROUTES_DIR, file), 'utf8'));
}

const ALL_USAGE_ROUTES = USAGE_ROUTE_FILES.flatMap((file) =>
    loadRoutes(file).map((route) => ({ ...route, file }))
);

describe('the parser can see what it claims to check', () => {
    /**
     * A guard that finds nothing everywhere is indistinguishable from a broken
     * one. These two cases are the positive controls: they prove the parser
     * reaches real declarations and that `declaresKey` can find a key that IS
     * there, so the absences asserted further down mean something.
     */
    it('finds every usage route across the three files', () => {
        expect(ALL_USAGE_ROUTES.length).toBeGreaterThanOrEqual(9);
        expect(ALL_USAGE_ROUTES.map((r) => r.name)).toEqual(
            expect.arrayContaining([...TRANSITION_ROUTES])
        );
    });

    it('sees the one permission that IS declared — the QR declaration', () => {
        const qr = ALL_USAGE_ROUTES.find((r) => r.name === 'protectedDeclareUsageRoute');

        expect(qr).toBeDefined();
        expect(declaresKey(qr?.config ?? '', 'requiredPermissions')).toBe(true);
        expect(qr?.config).toContain('HOST_TRADE_VIEW');
    });
});

describe('every usage endpoint is built by an authenticated factory', () => {
    it.each(
        ALL_USAGE_ROUTES.map((r) => [r.file, r.name, r.factory] as const)
    )('%s: %s uses %s', (_file, _name, factory) => {
        expect(factory.startsWith('createProtected')).toBe(true);
    });

    /**
     * `skipAuth` would make the route public while still reading like a
     * protected one, and the request suites could not tell the difference.
     */
    it.each(
        ALL_USAGE_ROUTES.map((r) => [r.file, r.name, r.config] as const)
    )('%s: %s does not opt out of auth', (_file, _name, config) => {
        expect(declaresKey(config, 'skipAuth')).toBe(false);
    });
});

/**
 * The three write budgets (T-062).
 *
 * `host-trade-rate-limits.test.ts` proves each limiter REFUSES at its budget,
 * driving requests through a purpose-built app. What it cannot prove is that
 * the limiter is attached to anything: it constructs its own. And the route
 * suites cannot prove it either, because they mount the route handlers on a
 * bare Hono app without the factory's middleware chain.
 *
 * So a `middlewares: [...]` line deleted from a route would leave both suites
 * green and the endpoint unlimited — the failure mode of a rate limit is that
 * nothing happens, which is also what success looks like from inside a test
 * that never exhausts it.
 */
describe('every write path declares its rate limit', () => {
    const BUDGETED_ROUTES = [
        ['usages.ts', 'protectedDeclareUsageRoute', 'hostDeclarationRateLimit'],
        ['mine-usages.ts', 'protectedDeclareUsageAsProviderRoute', 'providerDeclarationRateLimit'],
        ['reviews.ts', 'protectedCreateReviewRoute', 'hostTradeReviewRateLimit']
    ] as const;

    it.each(BUDGETED_ROUTES)('%s: %s wires %s', (file, name, limiter) => {
        const route = loadRoutes(file).find((r) => r.name === name);

        // Named explicitly rather than skipped: a renamed export must fail
        // here, not quietly stop being checked.
        expect(route, `${name} not found in ${file}`).toBeDefined();
        expect(declaresKey(route?.config ?? '', 'middlewares')).toBe(true);
        expect(route?.config).toContain(limiter);
    });
});

describe('the shared transitions declare no permission', () => {
    const transitions = ALL_USAGE_ROUTES.filter((r) =>
        (TRANSITION_ROUTES as readonly string[]).includes(r.name)
    );

    it('all three were found, so none of the cases below is vacuous', () => {
        expect(transitions.map((r) => r.name).sort()).toEqual([...TRANSITION_ROUTES].sort());
    });

    it.each(
        transitions.map((r) => [r.name, r.config] as const)
    )('%s declares no requiredPermissions, so its refusals stay 404', (_name, config) => {
        expect(declaresKey(config, 'requiredPermissions')).toBe(false);
    });
});
