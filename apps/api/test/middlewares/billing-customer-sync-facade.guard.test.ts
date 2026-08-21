/**
 * HOS-596 guard — every BillingCustomerSyncService is built on the TOLERANT facade.
 *
 * The runtime regression test
 * (`test/services/billing-customer-provider-failure.test.ts`) proves what a
 * `providerSyncErrorStrategy: 'log'` facade does: it keeps the local
 * `billing_customers` row when MercadoPago fails. What it cannot prove is that
 * production actually hands that facade to the sync service — it constructs the
 * facade itself.
 *
 * That gap is exactly how the defect survived: nothing tied the strategy to the
 * call sites. This guard closes it statically, and it is a guard rather than N
 * runtime tests because the failure mode is "one call site was forgotten", which
 * a per-call-site test can never detect for the site nobody wrote a test for.
 *
 * Anchored on `new BillingCustomerSyncService(` — the only way to construct the
 * service — so a new call site cannot appear outside the guard's view.
 *
 * @module test/middlewares/billing-customer-sync-facade.guard
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Absolute path to the API source root. */
const SRC_ROOT = resolve(__dirname, '../../src');

/** The middleware that owns both facades. */
const BILLING_MIDDLEWARE = resolve(SRC_ROOT, 'middlewares/billing.ts');

/**
 * The exact resolver call every construction site must trace back to. The flag
 * — not the function name — is what selects the tolerant facade.
 */
const TOLERANT_CALL = 'getQZPayBilling({ forCustomerSync: true })';

/** The bare resolver call, which yields the STRICT facade and must never feed the sync service. */
const STRICT_CALL = 'getQZPayBilling()';

/** The only way to construct the service. */
const CONSTRUCTION = 'new BillingCustomerSyncService(';

/**
 * Number of construction sites known at the time this guard was written: two in
 * `lib/auth.ts` plus one each in `middlewares/billing-customer.ts`,
 * `routes/billing/start-paid.ts`, `routes/commerce/protected/start-subscription.ts`
 * and `routes/host-onboarding/protected/start.ts`. The assertion is `>=`, not
 * `===`: a new call site is allowed, but a scan that silently finds nothing
 * (wrong root, renamed class) must never read as a pass.
 */
const MIN_CONSTRUCTION_SITES = 6;

/**
 * Recursively collect every TypeScript source file under a directory.
 *
 * @param dir - Absolute directory to walk
 * @returns Absolute paths of every `.ts` file found
 */
function collectSourceFiles(dir: string): string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) {
            found.push(...collectSourceFiles(full));
            continue;
        }

        if (extname(entry.name) === '.ts' && !entry.name.endsWith('.test.ts')) {
            found.push(full);
        }
    }

    return found;
}

/**
 * Extract the text of the FIRST constructor argument starting at the character
 * right after the opening parenthesis, stopping at the top-level `,` or `)`.
 *
 * @param source - Full file text
 * @param openParenIndex - Index of the `(` that opens the argument list
 * @returns The raw first-argument expression, trimmed
 */
function readFirstArgument(source: string, openParenIndex: number): string {
    let depth = 0;

    for (let i = openParenIndex + 1; i < source.length; i++) {
        const char = source[i];

        if (char === '(' || char === '[' || char === '{') {
            depth++;
            continue;
        }

        if (char === ')' && depth === 0) {
            return source.slice(openParenIndex + 1, i).trim();
        }

        if (char === ')' || char === ']' || char === '}') {
            depth--;
            continue;
        }

        if (char === ',' && depth === 0) {
            return source.slice(openParenIndex + 1, i).trim();
        }
    }

    return '';
}

/**
 * Remove comments so a documentation `@example` cannot be mistaken for a real
 * construction site — the JSDoc on `getQZPayBilling` shows the exact call this
 * guard looks for, and scanning it would make the guard assert on prose.
 *
 * @param source - Full file text
 * @returns The same text with block and line comments blanked out
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** One `new BillingCustomerSyncService(...)` occurrence found in the source. */
interface ConstructionSite {
    readonly file: string;
    readonly relativeFile: string;
    readonly argument: string;
    /** Offset of the construction inside the comment-stripped source. */
    readonly offset: number;
    /** The comment-stripped source of the file, so resolution sees one text. */
    readonly source: string;
}

/**
 * Find every construction site of the sync service under `src/`.
 *
 * @returns One entry per occurrence, with its first-argument expression
 */
function findConstructionSites(): ConstructionSite[] {
    const sites: ConstructionSite[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
        const source = stripComments(readFileSync(file, 'utf-8'));
        let index = source.indexOf(CONSTRUCTION);

        while (index !== -1) {
            const openParen = index + CONSTRUCTION.length - 1;

            sites.push({
                file,
                relativeFile: relative(SRC_ROOT, file),
                argument: readFirstArgument(source, openParen),
                offset: index,
                source
            });

            index = source.indexOf(CONSTRUCTION, index + CONSTRUCTION.length);
        }
    }

    return sites;
}

/**
 * Resolve which expression a local identifier holds AT a given construction
 * site: the nearest declaration of that name BEFORE the construction.
 *
 * Resolving by first global match instead would be an escape hatch, and a
 * verified one — `lib/auth.ts` declares `customerSyncBilling` twice (the signup
 * hook and the profile-update hook). A first-match lookup reads the signup one
 * for both, so switching only the SECOND to the strict facade left this guard
 * green while shipping the exact regression it exists to stop.
 *
 * @param site - The construction site whose argument is being resolved
 * @param identifier - The local name used as the first constructor argument
 * @returns The assigned expression, or `null` when no declaration precedes the site
 */
function resolveIdentifierAtSite(site: ConstructionSite, identifier: string): string | null {
    const declaration = new RegExp(`\\b(?:const|let|var)\\s+${identifier}\\s*=\\s*([^;]+);`, 'g');

    let assigned: string | null = null;
    let match = declaration.exec(site.source);

    while (match !== null && match.index < site.offset) {
        assigned = (match[1] ?? '').replace(/\s+/g, ' ').trim();
        match = declaration.exec(site.source);
    }

    return assigned;
}

/**
 * Decide whether a construction site's first argument resolves to the tolerant
 * facade — either inline, or through the local declaration actually in scope at
 * that site.
 *
 * @param site - The construction site to evaluate
 * @returns `null` when the site is compliant, otherwise the reason it is not
 */
function describeViolation(site: ConstructionSite): string | null {
    // Collapse whitespace so formatting cannot change the verdict, and drop a
    // trailing `?? null` / `?? undefined` — those still resolve to the same call.
    const expression = site.argument
        .replace(/\?\?[\s\S]*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (expression === TOLERANT_CALL) {
        return null;
    }

    if (!/^[A-Za-z_$][\w$]*$/.test(expression)) {
        return `argument \`${site.argument}\` is neither \`${TOLERANT_CALL}\` nor a local identifier`;
    }

    const assigned = resolveIdentifierAtSite(site, expression);

    if (assigned === null) {
        return `\`${expression}\` has no declaration preceding this construction`;
    }

    if (assigned === STRICT_CALL) {
        return `\`${expression}\` is assigned from the STRICT \`${STRICT_CALL}\``;
    }

    if (assigned !== TOLERANT_CALL) {
        return `\`${expression}\` is assigned from \`${assigned}\`, not \`${TOLERANT_CALL}\``;
    }

    return null;
}

/** A direct `<receiver>.customers.create(` call found in the source. */
interface CustomerCreateSite {
    readonly relativeFile: string;
    readonly receiver: string;
}

/**
 * Every place in `apps/api/src` allowed to create a billing customer, with the
 * receiver expression it must use.
 *
 * This is an exhaustive allowlist rather than a pattern, because "a third file
 * started creating billing customers" is a decision, not a refactor: whoever
 * adds one has to state which facade it uses and whether it recovers from the
 * 23505 the partial UNIQUE index now raises. `send-link.ts` was exactly that
 * case — it created partner customers on the strict facade, outside the sync
 * service and outside this guard's original reach.
 */
const ALLOWED_CUSTOMER_CREATE_SITES: readonly CustomerCreateSite[] = [
    // The sync service, whose facade is pinned by the construction-site check above.
    { relativeFile: 'services/billing-customer-sync.ts', receiver: 'this.billing' },
    // Partner admin send-link, which resolves the tolerant facade inline.
    { relativeFile: 'routes/partners/admin/send-link.ts', receiver: 'customerSyncBilling' }
];

/**
 * Find every direct `.customers.create(` call in the API source, together with
 * the receiver expression it is invoked on.
 *
 * @returns One entry per call site
 */
function findCustomerCreateSites(): CustomerCreateSite[] {
    const marker = '.customers.create(';
    const sites: CustomerCreateSite[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
        const source = stripComments(readFileSync(file, 'utf-8'));
        let index = source.indexOf(marker);

        while (index !== -1) {
            // Walk left over the receiver expression (identifier chars and dots).
            let start = index;
            while (start > 0 && /[\w$.]/.test(source[start - 1] ?? '')) {
                start--;
            }

            sites.push({
                relativeFile: relative(SRC_ROOT, file),
                receiver: source.slice(start, index).trim()
            });

            index = source.indexOf(marker, index + marker.length);
        }
    }

    return sites;
}

describe('HOS-596 guard — billing customer sync uses the tolerant QZPay facade', () => {
    it('builds a customer-sync facade with providerSyncErrorStrategy log', () => {
        // Arrange
        const source = readFileSync(BILLING_MIDDLEWARE, 'utf-8');

        // Act
        const assignmentIndex = source.indexOf('const customerSyncInstance = createQZPayBilling(');

        // Assert
        expect(assignmentIndex).toBeGreaterThan(-1);

        const call = source.slice(assignmentIndex, assignmentIndex + 400);
        expect(call).toContain("providerSyncErrorStrategy: 'log'");
        expect(source).toContain('options.forCustomerSync === true');
    });

    it('keeps the strict facade on throw so provider errors stay typed (SPEC-149 T-002)', () => {
        // Arrange
        const source = readFileSync(BILLING_MIDDLEWARE, 'utf-8');

        // Act
        const assignmentIndex = source.indexOf('const strictInstance = createQZPayBilling(');

        // Assert
        expect(assignmentIndex).toBeGreaterThan(-1);
        expect(source.slice(assignmentIndex, assignmentIndex + 400)).toContain(
            "providerSyncErrorStrategy: 'throw'"
        );
    });

    it('drops both facades together on init failure and on test reset', () => {
        // Arrange
        const source = readFileSync(BILLING_MIDDLEWARE, 'utf-8');

        // Act
        const clears = source.split('billingCustomerSyncInstance = null').length - 1;

        // Assert — one in the init catch block, one in resetBillingInstance.
        expect(clears).toBeGreaterThanOrEqual(2);
    });

    it('finds every construction site of BillingCustomerSyncService', () => {
        // Arrange / Act
        const sites = findConstructionSites();

        // Assert — a scan that found nothing is a broken guard, not a pass.
        expect(sites.length).toBeGreaterThanOrEqual(MIN_CONSTRUCTION_SITES);
    });

    it('passes the tolerant facade at every construction site', () => {
        // Arrange
        const sites = findConstructionSites();

        // Act
        const violations = sites
            .map((site) => {
                const reason = describeViolation(site);
                return reason === null ? null : `${site.relativeFile}: ${reason}`;
            })
            .filter((entry): entry is string => entry !== null);

        // Assert
        expect(
            violations,
            `BillingCustomerSyncService must be constructed with \`${TOLERANT_CALL}\` — the strict facade rolls the customer row back on a MercadoPago failure (HOS-596).\n${violations.join('\n')}`
        ).toEqual([]);
    });

    it('creates billing customers only at known, facade-reviewed call sites', () => {
        // Arrange
        const expected = ALLOWED_CUSTOMER_CREATE_SITES.map(
            (site) => `${site.relativeFile} :: ${site.receiver}`
        ).sort();

        // Act
        const actual = findCustomerCreateSites()
            .map((site) => `${site.relativeFile} :: ${site.receiver}`)
            .sort();

        // Assert — a new create site must be reviewed for which facade it uses
        // and whether it recovers from the 23505 the partial UNIQUE index raises.
        expect(actual).toEqual(expected);
    });
});
