/** The ioredis operations required by the effective-set cache. */
export interface RedisLike {
    get(key: string): Promise<string | null>;
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<number>;
    pexpire(key: string, milliseconds: number): Promise<number>;
    incr(key: string): Promise<number>;
}

/**
 * Serializes only the `user + vertical` part of the effective set: sources with
 * VERTICAL, USER and GLOBAL scope, excluding the LISTING delta. V3.4's snapshot
 * must retain `userId`, `vertical`, raw key values, `hasLiveNonTrialTitle` and
 * each key's strategy needed to fold the listing delta. On decode, rehydrate
 * values with `scopeKeyValues`; never expose a flat map, which would discard
 * the structural scope defense of AC:V3:3.
 */
export interface EffectiveSetCodec<T> {
    encode(value: T): string;
    decode(raw: string): T;
}

/** Structured diagnostic sink supplied by the composition root. */
export interface EffectiveSetCacheLogger {
    warn(
        message: string,
        fields: { readonly suspectEntries: number; readonly userId: string }
    ): void;
}
