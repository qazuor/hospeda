/**
 * HOS-765 static guard: the rescue routes keep their OWN permission.
 *
 * ## Why a static guard and not a handler test
 *
 * Route-handler tests in `apps/api` are a known trap for exactly this claim.
 * They routinely never reach the handler (a missing `user-agent`, a middleware
 * chain that does not complete) and then self-cover with an
 * `if (201) … else (not 404)` shape that passes either way, and `test/setup.ts`
 * mocks `@repo/db` wholesale so anything asserted about a query underneath is
 * vacuous. A test of that shape would report "the permission gate is correct"
 * on evidence that says nothing about the gate.
 *
 * What actually needs guarding is a source-level fact — that each of the three
 * routes DECLARES `BILLING_RECONCILIATION_MANAGE` — and a source-level fact is
 * what a source-level guard can prove.
 *
 * ## Why the claim is worth a guard at all
 *
 * The permission exists to keep two money-writing verbs off the grant that also
 * expires an add-on. Nothing fails at runtime if a future edit swaps one route
 * to `BILLING_MANAGE`: the route still works, the tests still pass, and the only
 * visible consequence is that everyone holding the broader grant can now move a
 * real charge from one customer's subscription to another's. That is precisely
 * the class of regression a static guard is for.
 *
 * ## Per call site, never per file
 *
 * The assertions run over each `createAdminRoute({...})` block SEPARATELY. A
 * `toContain` over the whole file would be satisfied by the FIRST route
 * declaring the permission while a second one silently forgot it — the exact
 * escape a file-level assertion cannot see.
 *
 * @module test/routes/billing/admin/payment-reconciliation.permission.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../../../src');

const ROUTE_FILE = 'routes/billing/admin/payment-reconciliation.ts';
const DIVERGENCE_SERVICE_FILE = 'services/billing/payment-divergence.service.ts';

/**
 * The permission every rescue route must declare.
 *
 * Asserted as a LITERAL rather than imported from `PermissionEnum`. The guard
 * reads source text, so importing the constant would compare the file's spelling
 * to itself via a different path and pass even if the enum member were renamed
 * out from under the routes.
 */
const REQUIRED_PERMISSION_TOKEN = 'PermissionEnum.BILLING_RECONCILIATION_MANAGE';

/** Permissions that must NOT appear on these routes. See the module JSDoc. */
const FORBIDDEN_PERMISSION_TOKENS = [
    'PermissionEnum.BILLING_MANAGE',
    'PermissionEnum.BILLING_READ_ALL'
] as const;

/** How many routes the file is expected to define. */
const EXPECTED_ROUTE_COUNT = 3;

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

/**
 * Remove comments so a guard cannot be satisfied — or blinded — by prose.
 *
 * BLOCK comments are stripped BEFORE line comments, and that order is
 * load-bearing rather than stylistic: stripping line comments first lets a `/*`
 * that happens to sit inside a `//` line survive as an unterminated block
 * opener, which then swallows the rest of the file. A guard reading a truncated
 * file cannot fail for anything in the part it never saw.
 *
 * @param source - Raw file text.
 * @returns The same text with comments removed.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Split the file into one text block per `createAdminRoute({...})` call.
 *
 * Deliberately crude — it slices from one factory call to the next rather than
 * balancing braces. That is enough to attribute a `requiredPermissions:` line to
 * the route that owns it, which is the only thing these assertions need, and it
 * has no parser to drift.
 */
function routeBlocks(source: string): string[] {
    const stripped = stripComments(source);
    const parts = stripped.split('createAdminRoute({');
    // The first chunk is everything before the first factory call — imports and
    // helpers, not a route.
    return parts.slice(1);
}

describe('HOS-765 rescue routes — permission guard', () => {
    const source = readSrc(ROUTE_FILE);
    const blocks = routeBlocks(source);

    it('defines exactly the three rescue routes', () => {
        // An instrument check. Every per-call-site assertion below iterates this
        // list, so a parse that silently found ZERO blocks would make all of them
        // pass while proving nothing at all.
        expect(
            blocks,
            'Expected three createAdminRoute({...}) call sites in the rescue route file. ' +
                'If a route was added, extend EXPECTED_ROUTE_COUNT and confirm the new one ' +
                'declares BILLING_RECONCILIATION_MANAGE.'
        ).toHaveLength(EXPECTED_ROUTE_COUNT);
    });

    it.each([0, 1, 2])('route #%i declares BILLING_RECONCILIATION_MANAGE', (index) => {
        const block = blocks[index] ?? '';
        expect(
            block,
            `createAdminRoute call site #${index} in ${ROUTE_FILE} does not declare ` +
                `${REQUIRED_PERMISSION_TOKEN}. These verbs write money into the ledger; ` +
                'the gate that opens them is their own permission, not a shared one.'
        ).toContain(REQUIRED_PERMISSION_TOKEN);
    });

    it.each([0, 1, 2])('route #%i declares requiredPermissions at all', (index) => {
        const block = blocks[index] ?? '';
        // Separate from the assertion above so a route that dropped the option
        // entirely reports as "no gate declared" rather than as "wrong gate".
        expect(block).toMatch(/requiredPermissions:\s*\[/);
    });

    it.each(FORBIDDEN_PERMISSION_TOKENS)('no route falls back to %s', (forbidden) => {
        for (const [index, block] of blocks.entries()) {
            expect(
                block,
                `createAdminRoute call site #${index} in ${ROUTE_FILE} references ${forbidden}. ` +
                    'Folding these routes into a shared billing grant would mean the permission ' +
                    'that lets someone expire an add-on also lets them move a real charge ' +
                    "from one customer's subscription to another's."
            ).not.toContain(forbidden);
        }
    });
});

describe('HOS-765 divergence report — the read path cannot write', () => {
    it('the divergence service does not import the rescue verbs', () => {
        // The report is documented as read-only and its module JSDoc says there is
        // deliberately no write path in it. An import of the reconcile service
        // would be the first step toward "just link the obvious one", which is the
        // single behaviour this whole area exists to prevent.
        const source = stripComments(readSrc(DIVERGENCE_SERVICE_FILE));

        expect(source).not.toContain('payment-reconcile.service');
        expect(source).not.toContain('forceLinkPreapproval');
        expect(source).not.toContain('backfillPayment');
    });

    it('the divergence service performs no database writes', () => {
        const source = stripComments(readSrc(DIVERGENCE_SERVICE_FILE));

        // Anchored on the Drizzle verbs rather than on the word "write": these are
        // the tokens that would actually appear, and a rename of the service would
        // not smuggle one past this.
        for (const verb of ['.insert(', '.update(', '.delete(']) {
            expect(
                source,
                `${DIVERGENCE_SERVICE_FILE} contains "${verb}". The divergence report is ` +
                    'read-only by contract: it proposes candidates and a human decides.'
            ).not.toContain(verb);
        }
    });
});
