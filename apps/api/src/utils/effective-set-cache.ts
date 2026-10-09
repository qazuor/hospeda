import { createEffectiveSetCache, type EffectiveSetCodec } from '@repo/verticals';
import { getClock } from './clock';
import { apiLogger } from './logger';
import { getRedisClient } from './redis';

type InvalidationPort = Pick<
    ReturnType<typeof createEffectiveSetCache<unknown>>,
    'invalidateUser' | 'invalidateAll'
>;

let activeCache: InvalidationPort | undefined;

/** The snapshot codec belongs to V3.4; this composition only supplies API infrastructure. */
export function createApiEffectiveSetCache<T>(codec: EffectiveSetCodec<T>) {
    const cache = createEffectiveSetCache({
        getClient: getRedisClient,
        clock: getClock().clock,
        logger: {
            warn: (message, fields) => apiLogger.warn({ message, ...fields })
        },
        codec
    });
    activeCache = cache;
    return cache;
}

function getInvalidator(): InvalidationPort {
    if (activeCache) return activeCache;
    return createApiEffectiveSetCache<never>({
        encode: () => {
            throw new Error('Invalidation-only cache cannot encode');
        },
        decode: () => {
            throw new Error('Invalidation-only cache cannot decode');
        }
    });
}

/** Call after the domain transaction commits. Failure is contained by the cache port. */
export async function invalidateEffectiveSetsForUser(userId: string): Promise<void> {
    try {
        await getInvalidator().invalidateUser({ userId });
    } catch (error) {
        apiLogger.warn({
            message: 'Effective-set invalidation failed',
            error: String(error),
            userId
        });
    }
}

/** Call after any plan version is published. Failure does not roll back publication. */
export async function invalidateAllEffectiveSets(): Promise<void> {
    try {
        await getInvalidator().invalidateAll();
    } catch (error) {
        apiLogger.warn({ message: 'Effective-set invalidation failed', error: String(error) });
    }
}
