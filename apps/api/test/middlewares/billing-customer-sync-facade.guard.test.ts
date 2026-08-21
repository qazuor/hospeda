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
 * Number of construction sites known at the time this guard was written. The
 * assertion is `>=`, not `===`: a new call site is allowed, but a scan that
 * silently finds nothing (wrong root, renamed class) must never read as a pass.
 */
const MIN_CONSTRUCTION_SITES = 5;

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
                argument: readFirstArgument(source, openParen)
            });

            index = source.indexOf(CONSTRUCTION, index + CONSTRUCTION.length);
        }
    }

    return sites;
}

/**
 * Decide whether a construction site's first argument resolves to the tolerant
 * facade — either inline, or through a local constant assigned from it and never
 * reassigned from the strict resolver.
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

    const source = stripComments(readFileSync(site.file, 'utf-8')).replace(/\s+/g, ' ');
    const assignment = new RegExp(`\\b(?:const|let|var) ${expression} = ([^;]+);`);
    const match = assignment.exec(source);

    if (match === null) {
        return `\`${expression}\` has no single-statement assignment this guard can verify`;
    }

    const assigned = match[1]?.trim() ?? '';

    if (assigned === STRICT_CALL) {
        return `\`${expression}\` is assigned from the STRICT \`${STRICT_CALL}\``;
    }

    if (assigned !== TOLERANT_CALL) {
        return `\`${expression}\` is assigned from \`${assigned}\`, not \`${TOLERANT_CALL}\``;
    }

    return null;
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
});
