/**
 * @file addon-receipt-localized-name.guard.test.ts
 * @description Pins the add-on purchase RECEIPT to the same copy source the
 * buyer read on screen (HOS-830).
 *
 * `AddonDefinition.name` / `.description` are English config literals by
 * convention (`packages/billing/CLAUDE.md`); the web never renders them raw,
 * resolving `account.addons.catalog.<slug>.*` by slug instead. The
 * `ADDON_PURCHASE` notification forwarded the config value straight through, so
 * a Spanish buyer's receipt arrived as "Add-on adquirido - Visibility Boost
 * (7 days)" — a name and a language that appeared on no screen they had seen.
 *
 * Why a STATIC guard rather than a behavioural test: the defect is a wiring
 * one — the correct resolver (`resolveAddonCheckoutName`, already covered by
 * `test/services/addon-checkout-locale.test.ts`, and already used by the
 * MercadoPago line item since HOS-606) simply was not called here. Executing
 * `confirmAddonPurchase` end-to-end would require standing up billing,
 * entitlements and a payment, and would still assert the same one fact. What it
 * would NOT do is fail when someone reverts this call site to `addon.name`,
 * because a raw English name is a perfectly valid string for every other
 * assertion in that flow.
 *
 * The guard reads ONE block — the `sendNotification` call for ADDON_PURCHASE —
 * rather than the whole file, so a matching token elsewhere in a 1400-line
 * service cannot satisfy it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = join(__dirname, '../../src/services/addon.checkout.ts');

/**
 * Extracts the `sendNotification({...})` call that emits ADDON_PURCHASE.
 *
 * Anchors on the notification type and stops at the closing `})` of the call,
 * so the assertions below can only be satisfied by that block.
 */
function readAddonPurchaseNotificationBlock(): string {
    const source = readFileSync(SOURCE_PATH, 'utf-8');
    const start = source.indexOf('type: NotificationType.ADDON_PURCHASE');
    expect(
        start,
        'ADDON_PURCHASE sendNotification call not found — did the emitter move?'
    ).toBeGreaterThan(-1);

    const end = source.indexOf('}).catch(', start);
    expect(end, 'Could not find the end of the ADDON_PURCHASE call').toBeGreaterThan(start);

    return source.slice(start, end);
}

describe('add-on receipt names the product in the buyer locale (HOS-830)', () => {
    it('resolves addonName through resolveAddonCheckoutName', () => {
        const block = readAddonPurchaseNotificationBlock();

        expect(block).toContain('addonName: resolveAddonCheckoutName({');
    });

    it('resolves addonDescription through resolveAddonCheckoutDescription', () => {
        const block = readAddonPurchaseNotificationBlock();

        expect(block).toContain('addonDescription: resolveAddonCheckoutDescription({');
    });

    it('never passes the raw English config literals as the buyer-facing copy', () => {
        const block = readAddonPurchaseNotificationBlock();

        // The exact pre-fix shape. `addon.name` still appears inside the block
        // as the `fallback:` argument — which is correct and deliberate — so
        // the assertion targets the ASSIGNMENT, not the identifier.
        expect(block).not.toMatch(/addonName:\s*addon\.name/);
        expect(block).not.toMatch(/addonDescription:\s*addon\.description/);
    });

    it('keeps the raw config value as the fallback, so a new add-on never ships an empty name', () => {
        const block = readAddonPurchaseNotificationBlock();

        expect(block).toMatch(/fallback:\s*addon\.name/);
        expect(block).toMatch(/fallback:\s*addon\.description/);
    });

    it('resolves against the RECIPIENT locale, not a hardcoded one', () => {
        const block = readAddonPurchaseNotificationBlock();

        // Asserted per RESOLVER CALL rather than by counting occurrences across
        // the block: the payload carries its own `locale: recipientLocale` for
        // the CTA link (HOS-722), so a total count would be satisfied by that
        // one alone and would break on any unrelated field added later.
        for (const resolver of ['resolveAddonCheckoutName', 'resolveAddonCheckoutDescription']) {
            const start = block.indexOf(`${resolver}({`);
            expect(start, `${resolver} not called`).toBeGreaterThan(-1);
            const call = block.slice(start, block.indexOf('})', start));

            expect(call, `${resolver} must use the recipient locale`).toMatch(
                /locale:\s*recipientLocale/
            );
        }

        // A hardcoded locale would mail a Portuguese buyer Spanish copy while
        // satisfying every assertion above.
        expect(block).not.toMatch(/locale:\s*['"](es|en|pt)['"]/);
    });
});
