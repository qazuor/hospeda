/**
 * HOS-1171 static guard: the comp grant is gated, and there is no way around
 * the preapproval hard-cancel.
 *
 * ## Why a static guard and not a handler test
 *
 * Same reason as `payment-reconciliation.permission.guard.test.ts` next door:
 * route-handler tests in `apps/api` routinely never reach the handler (a missing
 * `user-agent`, a middleware chain that does not complete) and then self-cover
 * with a shape that passes either way, and `test/setup.ts` mocks `@repo/db`
 * wholesale. Whether a route DECLARES a permission is a source-level fact, and a
 * source-level guard is what can prove it.
 *
 * ## The second claim is the one that matters more
 *
 * `createCompSubscription` inserts a `status='comp'` row and knows nothing about
 * MercadoPago. Everything that makes an ADMIN grant safe — retiring the
 * customer's existing subscriptions, hard-cancelling their preapprovals, and
 * ABORTING when MercadoPago refuses — lives in
 * `subscription-comp-grant.service.ts`. A second caller of the inserter is
 * therefore a second door to a comp granted on top of a preapproval that is
 * still charging: the exact HOS-751 failure mode, and one that breaks nothing at
 * runtime and fails no test. That is what this guard is for.
 *
 * @module test/routes/billing/admin/subscription-comp.permission.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../../../src');

const ROUTE_FILE = 'routes/billing/admin/subscription-comp.ts';
const GRANT_SERVICE_FILE = 'services/subscription-comp-grant.service.ts';

/**
 * The permission the grant must declare.
 *
 * A LITERAL, not an import of `PermissionEnum`. The guard reads source text, so
 * importing the constant would compare the file's spelling to itself through a
 * different path and stay green even if the enum member were renamed out from
 * under the route.
 */
const REQUIRED_PERMISSION_TOKEN = 'PermissionEnum.BILLING_MANAGE';

/** Module specifier of the raw inserter, as it appears in an import. */
const COMP_CREATE_MODULE = 'subscription-comp-create.service';

/**
 * The ONE production file allowed to import the raw inserter.
 *
 * Relative to `src/`. If a legitimate second caller ever appears, it has to do
 * the hard-cancel itself — or, better, call the grant service.
 */
const ALLOWED_COMP_CREATE_IMPORTERS: readonly string[] = [GRANT_SERVICE_FILE];

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

/**
 * Remove comments so a guard cannot be satisfied — or blinded — by prose.
 *
 * Block comments go BEFORE line comments, and the order is load-bearing: strip
 * line comments first and a `/*` sitting inside a `//` line survives as an
 * unterminated block opener that swallows the rest of the file. A guard reading
 * a truncated file cannot fail for anything in the part it never saw. This
 * module's own header names the inserter several times, which is precisely the
 * prose that would otherwise satisfy the assertions below.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Split a file into one text block per `createAdminRoute({...})` call. */
function routeBlocks(source: string): string[] {
    return stripComments(source).split('createAdminRoute({').slice(1);
}

/** Every `.ts` file under `src/`, as paths relative to `src/`. */
function allSourceFiles(dir = SRC_ROOT, prefix = ''): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const rel = prefix === '' ? entry : `${prefix}/${entry}`;
        if (statSync(full).isDirectory()) {
            out.push(...allSourceFiles(full, rel));
        } else if (entry.endsWith('.ts')) {
            out.push(rel);
        }
    }
    return out;
}

describe('HOS-1171 comp grant route — permission guard', () => {
    const blocks = routeBlocks(readSrc(ROUTE_FILE));

    it('defines exactly one admin route', () => {
        // Instrument check: the assertions below iterate this list, so a parse
        // that found ZERO blocks would make all of them pass while proving
        // nothing at all.
        expect(
            blocks,
            `Expected one createAdminRoute({...}) call site in ${ROUTE_FILE}. If a route ` +
                'was added, confirm it declares BILLING_MANAGE and extend this guard.'
        ).toHaveLength(1);
    });

    it('declares requiredPermissions at all', () => {
        // Separate from the token assertion so a route that dropped the option
        // entirely reports as "no gate declared" rather than as "wrong gate".
        expect(blocks[0] ?? '').toMatch(/requiredPermissions:\s*\[/);
    });

    it('declares BILLING_MANAGE', () => {
        expect(
            blocks[0] ?? '',
            `${ROUTE_FILE} does not declare ${REQUIRED_PERMISSION_TOKEN}. This verb hands a ` +
                'customer permanent free access and destroys their MercadoPago preapproval; ' +
                'it belongs to the same grant as its sibling grant-courtesy.'
        ).toContain(REQUIRED_PERMISSION_TOKEN);
    });
});

describe('HOS-1171 comp grant — the hard-cancel cannot be bypassed', () => {
    it('the route does not import the raw inserter', () => {
        const source = stripComments(readSrc(ROUTE_FILE));

        expect(
            source,
            `${ROUTE_FILE} imports ${COMP_CREATE_MODULE} directly. That inserter knows ` +
                'nothing about MercadoPago: calling it from the route skips the preapproval ' +
                'hard-cancel and comps a customer who is still being charged.'
        ).not.toContain(COMP_CREATE_MODULE);
    });

    it('exactly one production file imports the raw inserter', () => {
        const importers = allSourceFiles().filter((file) =>
            stripComments(readSrc(file)).includes(COMP_CREATE_MODULE)
        );

        expect(
            importers.slice().sort(),
            'Every path that creates a comp subscription must go through ' +
                `${GRANT_SERVICE_FILE}, which hard-cancels the customer's live preapprovals ` +
                'first and aborts when MercadoPago refuses. A second importer of ' +
                `${COMP_CREATE_MODULE} is a second door to the HOS-751 failure mode, and it ` +
                'breaks nothing at runtime.'
        ).toEqual([...ALLOWED_COMP_CREATE_IMPORTERS].sort());
    });

    it('the grant service inspects the hard-cancel outcome instead of ignoring it', () => {
        // `hardCancelPreapprovalBestEffort` NEVER THROWS — its refusal is a
        // returned `{ kind: 'failed' }`. Calling it and moving on is the whole
        // bug. The behavioural proof lives in
        // `test/services/subscription-comp-grant.service.test.ts`; this is the
        // cheap source-level companion that survives a refactor of the mocks.
        const source = stripComments(readSrc(GRANT_SERVICE_FILE));

        expect(source).toMatch(/outcome\s*=\s*await hardCancelPreapprovalBestEffort/);
        expect(source).toContain("outcome.kind === 'failed'");
    });
});
