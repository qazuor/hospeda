import type { Clock } from '@repo/billing-verticals-contract';
import type { EffectiveSetCacheLogger, EffectiveSetCodec, RedisLike } from './types';

const ENTRY_MAX_AGE_MS = 15 * 60 * 1000;
const GENERATION_TTL_MS = 30 * 60 * 1000;
const PREFIX = 'vset:v1:';

interface Envelope {
    readonly version: 1;
    readonly computedAt: number;
    readonly userGeneration: string;
    readonly allGeneration: string;
    readonly value: string;
}

/**
 * Redis-backed, generic effective-set cache. A failed INCR marks entries
 * suspect in this process for at most 15 minutes; while Redis is unavailable
 * reads use `load`. If Redis returns after that failure, another container can
 * still read an old entry until the 15-minute safety limit. This port never
 * makes a decision that charges money.
 */
export function createEffectiveSetCache<T>(args: {
    readonly getClient: () => Promise<RedisLike | undefined>;
    readonly clock: Clock;
    readonly logger: EffectiveSetCacheLogger;
    readonly codec: EffectiveSetCodec<T>;
}) {
    const suspectUsers = new Map<string, number>();
    let suspectAllUntil = 0;
    let suspectEntries = 0;

    const now = () => args.clock.now().getTime();
    const client = async (): Promise<RedisLike | undefined> => {
        try {
            return await args.getClient();
        } catch {
            return undefined;
        }
    };
    const generations = async (redis: RedisLike, userId: string) => {
        const [userGeneration, allGeneration] = await Promise.all([
            redis.get(`${PREFIX}gen:u:${userId}`),
            redis.get(`${PREFIX}gen:all`)
        ]);
        return { userGeneration: userGeneration ?? '0', allGeneration: allGeneration ?? '0' };
    };
    const suspect = (userId: string) => {
        suspectEntries += 1;
        args.logger.warn('Effective-set cache invalidation failed', { suspectEntries, userId });
    };

    return {
        async readThrough(input: {
            readonly userId: string;
            readonly vertical: string;
            readonly load: () => Promise<T>;
        }): Promise<T> {
            const redis = await client();
            if (!redis) return input.load();
            const instant = now();
            for (const [userId, until] of suspectUsers) {
                if (until <= instant) suspectUsers.delete(userId);
            }
            const isSuspect =
                suspectAllUntil > instant || (suspectUsers.get(input.userId) ?? 0) > instant;
            let current: Awaited<ReturnType<typeof generations>>;
            try {
                current = await generations(redis, input.userId);
                if (!isSuspect) {
                    const raw = await redis.hget(`${PREFIX}u:${input.userId}`, input.vertical);
                    if (raw !== null) {
                        try {
                            const envelope: unknown = JSON.parse(raw);
                            const readAt = now();
                            if (
                                isEnvelope(envelope) &&
                                envelope.userGeneration === current.userGeneration &&
                                envelope.allGeneration === current.allGeneration &&
                                envelope.computedAt <= readAt &&
                                readAt - envelope.computedAt < ENTRY_MAX_AGE_MS
                            ) {
                                // A second generation read closes the invalidation/hget race.
                                const latest = await generations(redis, input.userId);
                                if (
                                    latest.userGeneration === current.userGeneration &&
                                    latest.allGeneration === current.allGeneration
                                ) {
                                    return args.codec.decode(envelope.value);
                                }
                            }
                        } catch {
                            // A corrupt or obsolete value is a miss.
                        }
                    }
                }
            } catch {
                return input.load();
            }
            const value = await input.load();
            try {
                const envelope: Envelope = {
                    version: 1,
                    computedAt: now(),
                    userGeneration: current.userGeneration,
                    allGeneration: current.allGeneration,
                    value: args.codec.encode(value)
                };
                await redis.hset(
                    `${PREFIX}u:${input.userId}`,
                    input.vertical,
                    JSON.stringify(envelope)
                );
                await redis.pexpire(`${PREFIX}u:${input.userId}`, ENTRY_MAX_AGE_MS);
            } catch {
                // Cache writes do not affect domain reads.
            }
            return value;
        },
        /** Call after the domain transaction commits, never inside it. Does not recalculate. */
        async invalidateUser(input: { readonly userId: string }): Promise<void> {
            try {
                const redis = await client();
                if (!redis) throw new Error('Redis unavailable');
                const key = `${PREFIX}gen:u:${input.userId}`;
                await redis.incr(key);
                await redis.pexpire(key, GENERATION_TTL_MS);
                suspectUsers.delete(input.userId);
            } catch {
                suspectUsers.set(input.userId, now() + ENTRY_MAX_AGE_MS);
                suspect(input.userId);
            }
        },
        /** Call after plan publication commits, never inside its transaction. Does not recalculate. */
        async invalidateAll(): Promise<void> {
            try {
                const redis = await client();
                if (!redis) throw new Error('Redis unavailable');
                const key = `${PREFIX}gen:all`;
                await redis.incr(key);
                await redis.pexpire(key, GENERATION_TTL_MS);
                suspectAllUntil = 0;
            } catch {
                suspectAllUntil = now() + ENTRY_MAX_AGE_MS;
                suspect('*');
            }
        }
    };
}

function isEnvelope(value: unknown): value is Envelope {
    if (typeof value !== 'object' || value === null) return false;
    const item = value as Partial<Envelope>;
    return (
        item.version === 1 &&
        typeof item.computedAt === 'number' &&
        Number.isFinite(item.computedAt) &&
        typeof item.userGeneration === 'string' &&
        typeof item.allGeneration === 'string' &&
        typeof item.value === 'string'
    );
}
