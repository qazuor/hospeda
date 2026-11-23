/**
 * @file email-components.guard.test.ts
 * @description Static guard: email templates use the shared `Callout` and `Button`
 * (HOS-2565 D6, AC-2.3, AC-2.4).
 *
 * Source-based and fail-closed, over `packages/notifications/src` and
 * `packages/email/src`. Rules:
 *
 *   1. A `borderLeft` style (or `borderLeftWidth`, `borderLeftColor`, `borderLeftStyle`,
 *      or their kebab-case spelling) is a hand-rolled callout. It fails unless the file and
 *      style name are in {@link CARD_ALLOWLIST}.
 *   2. Bringing `Button` in from `@react-email/components` fails everywhere except
 *      `packages/email/src/components/button.tsx` (the shared button wraps it): named
 *      imports, namespace use, `export { Button } from`, `export * from`, and any
 *      `require()` or `import()` of the module.
 *   3. A `backgroundColor` written as a hex literal fails unless it is in
 *      {@link CARD_ALLOWLIST}. Colors come from `emailPalette`, through `Callout`.
 *   4. Allowlist entries are keyed by (file, owner, property) and exempt ONLY that
 *      property. Each must still match that exact property on that owner, so an
 *      exemption cannot outlive the style it excused, and a `borderLeft` added to a
 *      backgroundColor-only owner is not covered.
 *   5. The scanner is proven on fixtures before it is trusted
 *      (`email-components.guard.fixtures.test.ts`), and this guard fails on an
 *      empty scan so a broken glob cannot make it pass vacuously.
 *
 * Blind spots (what this guard cannot see):
 *   - a style assembled through spreads or computed keys (`{ [key]: '...' }`);
 *   - a `backgroundColor` whose value is not a literal (a variable, a ternary, a
 *     template with substitutions), and the `background` shorthand or `bgcolor`
 *     attribute;
 *   - a raw `<a>` styled by hand to look like a button;
 *   - colors that reach a component through props;
 *   - a callout drawn with the `border` shorthand, `borderInlineStart*` or an image
 *     rather than a `borderLeft*` key;
 *   - `Button` re-created from `Link` or `<a>`, or reached through a re-export in
 *     another package.
 * The catalog-wide render test (`apps/api/test/services/email-preview/
 * email-components-render.test.ts`) covers the rendered side of rule 1.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    type CardAllowlistEntry,
    evaluateEmailComponents,
    scanEmailSource
} from './helpers/email-components-scanner.js';

/** Repo `packages/` directory. */
const PACKAGES_DIR = join(__dirname, '../../..');

/** Trees the guard walks, as `packages/`-relative roots. */
const SCANNED_ROOTS = ['notifications/src', 'email/src'] as const;

/** The one file allowed to import `Button` from react-email (rule 2). */
const SHARED_BUTTON_FILE = 'email/src/components/button.tsx';

/** The one file allowed to draw the callout border (rule 1). */
const SHARED_CALLOUT_FILE = 'email/src/components/callout.tsx';

const LIST_CARD = 'Per-item list card of a digest. It frames one listing, it is not a notice.';
const RECEIPT_CARD =
    'Receipt card holding InfoRow lines. A card, not a callout: pageBackground with a 1px border.';
const STAFF_BADGE =
    'Staff-template badge (type, admin marker or severity chip). A label, not a callout; the staff look stays unchanged (HOS-2565 AC-4.1).';
const STAFF_PANEL =
    'Staff-template data panel (details, message or code block). Holds labeled data, not a notice; the staff look stays unchanged (HOS-2565 AC-4.1).';

/**
 * Frozen allowlist. Adding an entry is a deliberate review decision, and removing the
 * style it excuses without removing the entry fails rule 4.
 */
const CARD_ALLOWLIST: readonly CardAllowlistEntry[] = [
    {
        file: 'notifications/src/templates/alerts/PriceDropItem.tsx',
        style: 'itemBox',
        property: 'borderLeft',
        reason: LIST_CARD
    },
    {
        file: 'notifications/src/templates/alerts/PriceDropItem.tsx',
        style: 'itemBox',
        property: 'backgroundColor',
        reason: LIST_CARD
    },
    {
        file: 'notifications/src/templates/alerts/PromoOfferItem.tsx',
        style: 'itemBox',
        property: 'borderLeft',
        reason: LIST_CARD
    },
    {
        file: 'notifications/src/templates/alerts/PromoOfferItem.tsx',
        style: 'itemBox',
        property: 'backgroundColor',
        reason: LIST_CARD
    },
    {
        file: 'notifications/src/templates/ai/ai-questions-weekly-digest.tsx',
        style: 'listingBox',
        property: 'borderLeft',
        reason: LIST_CARD
    },
    {
        file: 'notifications/src/templates/ai/ai-questions-weekly-digest.tsx',
        style: 'listingBox',
        property: 'backgroundColor',
        reason: LIST_CARD
    },
    {
        file: 'notifications/src/templates/billing/payment-success.tsx',
        style: 'receiptBox',
        property: 'backgroundColor',
        reason: RECEIPT_CARD
    },
    {
        file: 'notifications/src/templates/billing/purchase-confirmation.tsx',
        style: 'receiptBox',
        property: 'backgroundColor',
        reason: RECEIPT_CARD
    },
    {
        file: 'notifications/src/templates/admin/admin-payment-failure.tsx',
        style: 'adminBadge',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-payment-failure.tsx',
        style: 'severityInfo',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-payment-failure.tsx',
        style: 'severityWarning',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-payment-failure.tsx',
        style: 'severityCritical',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-payment-failure.tsx',
        style: 'detailsBox',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/admin/admin-payment-failure.tsx',
        style: 'jsonBlock',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/admin/admin-system-event.tsx',
        style: 'adminBadge',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-system-event.tsx',
        style: 'severityInfo',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-system-event.tsx',
        style: 'severityWarning',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-system-event.tsx',
        style: 'severityCritical',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/admin-system-event.tsx',
        style: 'detailsBox',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/admin/admin-system-event.tsx',
        style: 'jsonBlock',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/admin/ai-cost-threshold-alert.tsx',
        style: 'getSeverityStyle',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/ai-cost-threshold-alert.tsx',
        style: 'adminBadge',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/admin/ai-cost-threshold-alert.tsx',
        style: 'detailsBox',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/contact/ContactSubmissionEmail.tsx',
        style: 'typeBadge',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/contact/ContactSubmissionEmail.tsx',
        style: 'infoBox',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/contact/ContactSubmissionEmail.tsx',
        style: 'messageBlock',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/feedback/FeedbackReportEmail.tsx',
        style: 'typeBadge',
        property: 'backgroundColor',
        reason: STAFF_BADGE
    },
    {
        file: 'notifications/src/templates/feedback/FeedbackReportEmail.tsx',
        style: 'infoBox',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/feedback/FeedbackReportEmail.tsx',
        style: 'codeSection',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    },
    {
        file: 'notifications/src/templates/feedback/FeedbackReportEmail.tsx',
        style: 'codeBlock',
        property: 'backgroundColor',
        reason: STAFF_PANEL
    }
];

/** Lists every `.ts` / `.tsx` source file under a directory, test files excluded. */
function listSourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return entry === '__tests__' ? [] : listSourceFiles({ dir: full });
        }
        if (/\.(test|spec)\.tsx?$/.test(entry) || entry.endsWith('.d.ts')) return [];
        return /\.tsx?$/.test(entry) ? [full] : [];
    });
}

/** Everything the scanner found, per `packages/`-relative file. */
function scanAll(): ReadonlyMap<string, ReturnType<typeof scanEmailSource>> {
    const result = new Map<string, ReturnType<typeof scanEmailSource>>();
    for (const root of SCANNED_ROOTS) {
        for (const file of listSourceFiles({ dir: join(PACKAGES_DIR, root) })) {
            result.set(
                relative(PACKAGES_DIR, file),
                scanEmailSource({ fileName: file, source: readFileSync(file, 'utf-8') })
            );
        }
    }
    return result;
}

describe('email components guard (HOS-2565)', () => {
    const scans = scanAll();

    it('scans a real tree (a broken glob must not pass vacuously)', () => {
        // Assert
        expect(scans.size).toBeGreaterThan(100);
        expect(scans.has(SHARED_BUTTON_FILE)).toBe(true);
        expect(scans.has(SHARED_CALLOUT_FILE)).toBe(true);
    });

    const verdict = evaluateEmailComponents({
        scans,
        allowlist: CARD_ALLOWLIST,
        sharedButtonFile: SHARED_BUTTON_FILE,
        sharedCalloutFile: SHARED_CALLOUT_FILE,
        fileExists: (file) => existsSync(join(PACKAGES_DIR, file))
    });

    it('rule 1: no borderLeft outside callout.tsx and the card allowlist', () => {
        // Assert
        expect(verdict.borderLeft).toEqual([]);
    });

    it('rule 2: no Button import from react-email outside the shared button', () => {
        // Assert
        expect(verdict.reactEmailButton).toEqual([]);
    });

    it('rule 3: no hex backgroundColor outside the card allowlist', () => {
        // Assert
        expect(verdict.hexBackground).toEqual([]);
    });

    it('rule 4: every allowlist entry still matches a style in an existing file', () => {
        // Assert
        expect(verdict.staleAllowlist).toEqual([]);
    });

    it('every allowlist entry carries a reason and is unique', () => {
        // Act
        const keys = CARD_ALLOWLIST.map(
            (entry) => `${entry.file}#${entry.style}.${entry.property}`
        );

        // Assert
        expect(new Set(keys).size).toBe(keys.length);
        expect(CARD_ALLOWLIST.every((entry) => entry.reason.length > 20)).toBe(true);
    });
});
