import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const MARKER = 'HOS-1352: transitional until V3';
const INVENTORY = [
    [
        'apps/api/src/cron/jobs/addon-expiry.job.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/cron/jobs/index.ts',
        'not-a-gate',
        'cron registration of the removed billing jobs (U1 cleanup), not a gate'
    ],
    [
        'apps/api/src/cron/jobs/propagate-plan-price-changes.job.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/cron/registry.ts',
        'not-a-gate',
        'cron registry entries of the removed billing jobs (U1 cleanup), not a gate'
    ],
    [
        'apps/api/src/lib/content-detection.ts',
        'not-a-gate',
        'pure string helper kept for the content gates of V5.11; not a gate itself'
    ],
    [
        'apps/api/src/middlewares/accommodation-entitlements.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/actor.ts',
        'not-a-gate',
        'U1 removed the actor.entitlements wiring; the actor no longer carries plan data (V5)'
    ],
    [
        'apps/api/src/middlewares/ai-quota.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/commerce-entitlement.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/commerce-limit-enforcement.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/entitlement.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/limit-enforcement.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/owner-entitlement.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/require-live-subscription.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/middlewares/tourist-entitlements.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    ['apps/api/src/routes/accommodation/admin/addFeaturedMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/accommodation/admin/addMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/accommodation/protected/addFaq.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/accommodation/protected/addFeaturedMedia.ts',
        'restored',
        'listingAccess'
    ],
    ['apps/api/src/routes/accommodation/protected/addMedia.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/accommodation/protected/addOccupancy.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/accommodation/protected/batchOccupancy.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/accommodation/protected/calendarConnectGoogle.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/accommodation/protected/calendarConnectIcal.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/accommodation/protected/calendarSync.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    ['apps/api/src/routes/accommodation/protected/compare.ts', 'this-leaf', 'enforceUserGate'],
    [
        'apps/api/src/routes/accommodation/protected/create.ts',
        'restored',
        'listingAccess|paidFieldsFilter'
    ],
    [
        'apps/api/src/routes/accommodation/protected/createDraft.ts',
        'restored',
        'listingAccess|paidFieldsFilter'
    ],
    [
        'apps/api/src/routes/accommodation/protected/getById.ts',
        'restored',
        'effectiveSet|paidFieldsFilter'
    ],
    ['apps/api/src/routes/accommodation/protected/getWhatsApp.ts', 'restored', 'readEffectiveKeys'],
    [
        'apps/api/src/routes/accommodation/protected/hostFavoritesBreakdown.ts',
        'restored',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/accommodation/protected/hostMarketComparison.ts',
        'restored',
        'enforceUserGate'
    ],
    ['apps/api/src/routes/accommodation/protected/import-from-url.ts', 'restored', 'aiQuotaGate'],
    [
        'apps/api/src/routes/accommodation/protected/patch.ts',
        'restored',
        'listingAccess|paidFieldsFilter'
    ],
    ['apps/api/src/routes/accommodation/protected/removeFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/accommodation/protected/removeMedia.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/accommodation/protected/removeOccupancy.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    ['apps/api/src/routes/accommodation/protected/reorderFaqs.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/accommodation/protected/reorderMedia.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/accommodation/protected/setFeaturedMedia.ts',
        'restored',
        'listingAccess'
    ],
    [
        'apps/api/src/routes/accommodation/protected/update.ts',
        'restored',
        'listingAccess|paidFieldsFilter'
    ],
    ['apps/api/src/routes/accommodation/protected/updateFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/accommodation/protected/updateMedia.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/accommodation/protected/updateOccupancyEvent.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/accommodation/public/getByDestination.ts',
        'restored',
        'paidFieldsFilter'
    ],
    ['apps/api/src/routes/accommodation/public/getById.ts', 'restored', 'paidFieldsFilter'],
    ['apps/api/src/routes/accommodation/public/getBySlug.ts', 'restored', 'paidFieldsFilter'],
    [
        'apps/api/src/routes/accommodation/public/getTopRatedByDestination.ts',
        'restored',
        'paidFieldsFilter'
    ],
    ['apps/api/src/routes/accommodation/public/list.ts', 'this-leaf', 'readEffectiveKeys'],
    ['apps/api/src/routes/accommodation/public/similar.ts', 'restored', 'paidFieldsFilter'],
    [
        'apps/api/src/routes/accommodation/reviews/protected/create.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/ai/protected/chat.ts',
        'restored',
        'readEffectiveKeys|aiQuotaGate|effectiveSet'
    ],
    ['apps/api/src/routes/ai/protected/search-chat.ts', 'restored', 'aiQuotaGate'],
    ['apps/api/src/routes/ai/protected/text-improve.ts', 'restored', 'aiQuotaGate'],
    ['apps/api/src/routes/ai/protected/translate.ts', 'restored', 'aiQuotaGate'],
    [
        'apps/api/src/routes/billing/admin/addons.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/routes/billing/admin/customer-entitlements.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/routes/billing/usage.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/routes/commerce/protected/create.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/routes/conversations/protected/monthly-inquiries.ts',
        'restored',
        'enforceUserGate'
    ],
    ['apps/api/src/routes/conversations/protected/response-rate.ts', 'restored', 'enforceUserGate'],
    ['apps/api/src/routes/destination/public/getAccommodations.ts', 'restored', 'paidFieldsFilter'],
    ['apps/api/src/routes/destination/reviews/protected/create.ts', 'this-leaf', 'enforceUserGate'],
    ['apps/api/src/routes/experience/protected/addFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/addFeaturedMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/addMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/brochure.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/experience/protected/certificates.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    ['apps/api/src/routes/experience/protected/patch.ts', 'restored', 'listingAccess|capabilities'],
    ['apps/api/src/routes/experience/protected/removeFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/removeMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/reorderFaqs.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/reorderMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/setFeaturedMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/updateFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/updateMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/experience/protected/viewStats.ts', 'restored', 'enforceUserGate'],
    [
        'apps/api/src/routes/experience/protected/viewStatsDailySeries.ts',
        'restored',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/feature/public/getAccommodationsByFeature.ts',
        'restored',
        'paidFieldsFilter'
    ],
    ['apps/api/src/routes/gastronomy/protected/addFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/addFeaturedMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/addMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/brochure.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/gastronomy/protected/deleteMenuFile.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    ['apps/api/src/routes/gastronomy/protected/menuQr.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/menuQrScans.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/patch.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/gastronomy/protected/putDailySpecials.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/gastronomy/protected/putEvents.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/gastronomy/protected/putMenu.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    ['apps/api/src/routes/gastronomy/protected/removeFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/removeMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/reorderFaqs.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/reorderMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/setFeaturedMedia.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/updateFaq.ts', 'restored', 'listingAccess'],
    ['apps/api/src/routes/gastronomy/protected/updateMedia.ts', 'restored', 'listingAccess'],
    [
        'apps/api/src/routes/gastronomy/protected/uploadMenuFile.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    [
        'apps/api/src/routes/gastronomy/protected/uploadMenuItemPhoto.ts',
        'restored',
        'listingAccess|capabilities'
    ],
    ['apps/api/src/routes/gastronomy/protected/viewStats.ts', 'restored', 'enforceUserGate'],
    [
        'apps/api/src/routes/gastronomy/protected/viewStatsDailySeries.ts',
        'restored',
        'enforceUserGate'
    ],
    ['apps/api/src/routes/gastronomy/public/getBySlug.ts', 'restored', 'readEffectiveKeys'],
    [
        'apps/api/src/routes/host-onboarding/protected/precheck.ts',
        'not-a-gate',
        'publish precheck: HOS-1471 (Coord-64 H6), merged'
    ],
    [
        'apps/api/src/routes/host-onboarding/protected/start.ts',
        'not-a-gate',
        'U1 removed the billing-customer sync after host promotion; not a gate'
    ],
    ['apps/api/src/routes/host/protected/dashboard.ts', 'restored', 'enforceUserGate'],
    ['apps/api/src/routes/media/admin/upload.ts', 'restored', 'effectiveSet'],
    ['apps/api/src/routes/owner-promotion/protected/create.ts', 'restored', 'enforceUserGate'],
    [
        'apps/api/src/routes/owner-promotion/protected/exclusive-deals.ts',
        'restored',
        'enforceUserGate|readEffectiveKeys'
    ],
    ['apps/api/src/routes/owner-promotion/protected/patch.ts', 'restored', 'enforceUserGate'],
    ['apps/api/src/routes/owner-promotion/protected/update.ts', 'restored', 'enforceUserGate'],
    ['apps/api/src/routes/price-alert/protected/create.ts', 'restored', 'enforceUserGate'],
    ['apps/api/src/routes/recommendations/protected/get.ts', 'this-leaf', 'enforceUserGate'],
    ['apps/api/src/routes/search-history/protected/list.ts', 'this-leaf', 'enforceUserGate'],
    [
        'apps/api/src/routes/user-bookmark-collection/protected/addBookmark.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/user-bookmark-collection/protected/create.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/user-bookmark-collection/protected/delete.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/user-bookmark-collection/protected/getById.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/user-bookmark-collection/protected/list.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/user-bookmark-collection/protected/removeBookmark.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    [
        'apps/api/src/routes/user-bookmark-collection/protected/update.ts',
        'this-leaf',
        'enforceUserGate'
    ],
    ['apps/api/src/routes/user-bookmark/protected/create.ts', 'this-leaf', 'enforceUserGate'],
    [
        'apps/api/src/routes/user/protected/entitlements.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/routes/user/protected/index.ts',
        'not-a-gate',
        'U1 unmounted /me/subscription and /me/entitlements; the web replacement is HOS-1646 (AC:B13a:26)'
    ],
    ['apps/api/src/routes/user/public/getAccommodations.ts', 'restored', 'paidFieldsFilter'],
    ['apps/api/src/routes/views/protected/accommodations-me.ts', 'restored', 'enforceUserGate'],
    ['apps/api/src/routes/views/protected/daily-series.ts', 'restored', 'enforceUserGate'],
    [
        'apps/api/src/services/addon-entitlement.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/addon-lifecycle-cancellation.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/addon-lifecycle.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/addon-plan-change.helpers.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/addon-plan-change.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/addon-purchase-adjustments.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/addon.user-addons.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/ai-context/chat-owner-grants.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/ai-context/experience-ai-context.ts',
        'not-a-gate',
        'HOS-1644 run 4: the route decides, the context stays pure'
    ],
    [
        'apps/api/src/services/ai-context/gastronomy-ai-context.ts',
        'not-a-gate',
        'HOS-1644 run 4: the route decides, the context stays pure'
    ],
    ['apps/api/src/services/ai-context/types.ts', 'not-a-gate', 'HOS-1644 run 4'],
    [
        'apps/api/src/services/billing/addon-grant-domain.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/billing/edit-eligibility.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/billing/tourist-vip-inheritance.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/deferred-addon-grants.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/plan-upgrade-restoration.deps.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/publish-precheck.service.ts',
        'not-a-gate',
        'publish precheck: HOS-1471 (Coord-64 H6), merged'
    ],
    [
        'apps/api/src/services/subscription-downgrade-excess.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/trial.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/services/usage-tracking.service.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    ['apps/api/src/types.ts', 'this-leaf', 'NO_MARKER'],
    [
        'apps/api/src/utils/create-app.ts',
        'not-a-gate',
        'U1 removed the billing middlewares from the app chain; not a gate'
    ],
    ['apps/api/src/utils/entitlement-filter.ts', 'restored', 'readEffectiveKeys|paidFieldsFilter'],
    [
        'apps/api/src/utils/limit-check.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/utils/limit-key-product-domain.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ],
    [
        'apps/api/src/utils/tourist-entitlement-filter.ts',
        'retired',
        'deleted by U1 or later; no route left to gate'
    ]
] as const;

const MECHANISM_ALIASES: Readonly<Record<string, readonly string[]>> = {
    aiQuotaGate: ['aiQuotaGate', 'evaluateAiQuota'],
    paidFieldsFilter: ['paidFieldsFilter', 'filterPublicPaidFields']
};

function codeWithoutComments(source: string): string {
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        true,
        ts.LanguageVariant.Standard,
        source
    );
    const tokens: string[] = [];
    for (
        let token = scanner.scan();
        token !== ts.SyntaxKind.EndOfFileToken;
        token = scanner.scan()
    ) {
        tokens.push(scanner.getTokenText());
    }
    return tokens.join(' ');
}

describe('TEST:V5:34 U1 gate inventory', () => {
    it('covers all U1 route inventory entries', () => {
        for (const [file, kind, evidence] of INVENTORY) {
            const absolute = path.join(ROOT, file);
            const exists = existsSync(absolute);
            if (kind === 'retired') {
                expect(exists, file).toBe(false);
                continue;
            }
            if (kind === 'not-a-gate') {
                if (!exists) continue;
                expect(readFileSync(absolute, 'utf8'), file).not.toContain(MARKER);
                continue;
            }
            expect(exists, file).toBe(true);
            const source = readFileSync(absolute, 'utf8');
            expect(source, file).not.toContain(MARKER);
            if (evidence === 'NO_MARKER') continue;
            const code = codeWithoutComments(source);
            const mechanisms = evidence.split('|');
            const normalizedCode = code.replace(/[^a-z0-9]/gi, '').toLowerCase();
            expect(
                mechanisms.some((mechanism) =>
                    (MECHANISM_ALIASES[mechanism] ?? [mechanism]).some((candidate) =>
                        normalizedCode.includes(candidate.replace(/[^a-z0-9]/gi, '').toLowerCase())
                    )
                ),
                file
            ).toBe(true);
        }
    });
});
