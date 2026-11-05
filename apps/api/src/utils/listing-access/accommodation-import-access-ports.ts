import { accommodations, and, eq, getDb, isNull, subscriptionModel } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { resolveEntitlementStep } from '@repo/verticals';
import { createConditionalSlidingWindowConsumer } from '../../middlewares/rate-limit';
import { buildTrialStartReader } from '../listing-publication/trial-start-reader';
import { AI_ENTITLEMENT_KEY_BY_FEATURE } from './ai-quota-catalog';
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
        /** Reads the canonical accommodation trial history for the user. */
        async hasHadTrial(input: { readonly userId: string }): Promise<boolean> {
            const reader = buildTrialStartReader({ client: getDb() });
            return (
                (await reader.findTrialOfUser({
                    userId: input.userId,
                    vertical: VerticalEnum.ACCOMMODATION
                })) !== null
            );
        },
        /** Reads all accommodation subscription history through the DB model. */
        async hasHadSubscription(input: { readonly userId: string }): Promise<boolean> {
            return subscriptionModel.existsAnyForUser({
                userId: input.userId,
                vertical: VerticalEnum.ACCOMMODATION
            });
        },
        async hasPublishedAccommodation(input: { readonly userId: string }): Promise<boolean> {
            const [row] = await getDb()
                .select({ id: accommodations.id })
                .from(accommodations)
                .where(
                    and(
                        eq(accommodations.ownerId, input.userId),
                        eq(accommodations.publicationStatus, 'PUBLISHED'),
                        isNull(accommodations.deletedAt)
                    )
                )
                .limit(1);
            return row !== undefined;
        },
        async hasImportEntitlement(input: { readonly userId: string }): Promise<boolean> {
            const decision = await resolveEntitlementStep({
                userId: input.userId,
                vertical: VerticalEnum.ACCOMMODATION,
                keys: [AI_ENTITLEMENT_KEY_BY_FEATURE.accommodation_import],
                effectiveSet: getListingAccessPorts().effectiveSet
            });
            return decision.allowed;
        },
        countNewUserImports(input: { readonly userId: string }): Promise<number> {
            return consume.count(input.userId);
        },
        consumeNewUserImport(input: { readonly userId: string }): Promise<boolean> {
            return consume.consume(input.userId);
        }
    };
}
