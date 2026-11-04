import { accommodations, and, eq, getDb, isNull, subscriptions } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { resolveEntitlementStep } from '@repo/verticals';
import { createConditionalSlidingWindowConsumer } from '../../middlewares/rate-limit';
import { buildTrialStartReader } from '../listing-publication/trial-start-reader';
import { getListingAccessPorts } from './ports';

/** New users without the importer entitlement may import five times per rolling 24 hours. */
export const ACCOMMODATION_IMPORT_NEW_USER_MAX = 5;
const NEW_USER_IMPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
const NEW_USER_IMPORT_KEY_PREFIX = 'accommodation-import-new-user';
const consume = createConditionalSlidingWindowConsumer({
    keyPrefix: NEW_USER_IMPORT_KEY_PREFIX,
    windowMs: NEW_USER_IMPORT_WINDOW_MS,
    max: ACCOMMODATION_IMPORT_NEW_USER_MAX
});

/** API adapters for the new-user exemption. All reads use existing Drizzle models/readers. */
export function getAccommodationImportAccessPorts() {
    return {
        async hasHadTrial(userId: string): Promise<boolean> {
            const reader = buildTrialStartReader({ client: getDb() });
            return (
                (await reader.findTrialOfUser({ userId, vertical: VerticalEnum.ACCOMMODATION })) !==
                null
            );
        },
        async hasHadSubscription(userId: string): Promise<boolean> {
            const [row] = await getDb()
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.userId, userId),
                        eq(subscriptions.vertical, VerticalEnum.ACCOMMODATION)
                    )
                )
                .limit(1);
            return row !== undefined;
        },
        async hasPublishedAccommodation(userId: string): Promise<boolean> {
            const [row] = await getDb()
                .select({ id: accommodations.id })
                .from(accommodations)
                .where(
                    and(
                        eq(accommodations.ownerId, userId),
                        eq(accommodations.publicationStatus, 'PUBLISHED'),
                        isNull(accommodations.deletedAt)
                    )
                )
                .limit(1);
            return row !== undefined;
        },
        async hasImportEntitlement(userId: string): Promise<boolean> {
            const decision = await resolveEntitlementStep({
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                keys: ['ai_accommodation_import'],
                effectiveSet: getListingAccessPorts().effectiveSet
            });
            return decision.allowed;
        },
        countNewUserImports(userId: string): Promise<number> {
            return consume.count(userId);
        },
        consumeNewUserImport(userId: string): Promise<boolean> {
            return consume.consume(userId);
        }
    };
}
