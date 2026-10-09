import type { RedisLike } from '../../src';

/** A shared Redis substitute for two independent cache instances. */
export class FakeRedis implements RedisLike {
    readonly strings = new Map<string, string>();
    readonly hashes = new Map<string, Map<string, string>>();
    readonly expirations = new Map<string, number>();
    failReads = false;
    failWrites = false;
    failIncr = false;

    async get(key: string): Promise<string | null> {
        if (this.failReads) throw new Error('read unavailable');
        return this.strings.get(key) ?? null;
    }

    async hget(key: string, field: string): Promise<string | null> {
        if (this.failReads) throw new Error('read unavailable');
        return this.hashes.get(key)?.get(field) ?? null;
    }

    async hset(key: string, field: string, value: string): Promise<number> {
        if (this.failWrites) throw new Error('write unavailable');
        const hash = this.hashes.get(key) ?? new Map<string, string>();
        const added = hash.has(field) ? 0 : 1;
        hash.set(field, value);
        this.hashes.set(key, hash);
        return added;
    }

    async pexpire(key: string, milliseconds: number): Promise<number> {
        if (this.failWrites) throw new Error('write unavailable');
        this.expirations.set(key, milliseconds);
        return this.strings.has(key) || this.hashes.has(key) ? 1 : 0;
    }

    async incr(key: string): Promise<number> {
        if (this.failIncr) throw new Error('increment unavailable');
        const next = Number(this.strings.get(key) ?? '0') + 1;
        this.strings.set(key, String(next));
        return next;
    }
}
