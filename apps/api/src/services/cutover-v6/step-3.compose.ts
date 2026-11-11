import { subscribeEffectiveSetCoverageInvalidation } from '../../utils/effective-set-coverage-invalidation.js';
import {
    drainListingCoverageRecalculations,
    subscribeListingCoverageRecalculation
} from '../../utils/listing-publication/coverage-listener.js';
import { apiLogger } from '../../utils/logger.js';
import { disconnectRedis } from '../../utils/redis.js';

/** The coverage listeners of one V6 step 3 CLI run; `stop` waits for in-flight listing recalculations. */
export interface Step3ProcessComposition {
    readonly stop: () => Promise<void>;
}

/**
 * Subscribes the two coverage consumers the step 3 notice must reach in the CLI
 * process (HOS-2091): listing recalculation and effective-set cache invalidation.
 * Trial conversion is not subscribed because it ignores TRIAL notices.
 *
 * @returns The composition whose `stop` unsubscribes both and drains recalculations
 */
export function composeStep3Process(): Step3ProcessComposition {
    const stopListing = subscribeListingCoverageRecalculation();
    const stopEffectiveSetInvalidation = subscribeEffectiveSetCoverageInvalidation();
    return {
        async stop() {
            stopListing();
            stopEffectiveSetInvalidation();
            await drainListingCoverageRecalculations();
            try {
                await disconnectRedis();
            } catch (error) {
                apiLogger.error({ error }, 'Failed to disconnect Redis after cutover step 3');
            }
        }
    };
}
