import { createHash } from 'node:crypto';
import type { InternalModerationResult } from './provider.js';

type CacheEntry = {
    readonly value: InternalModerationResult;
    readonly expiresAt: number;
    readonly matchedTermsSignature: string;
};

type TimedEvent = { readonly timestamp: number };

const DEFAULT_CACHE_CAPACITY = 500;
const ONE_HOUR_MS = 60 * 60 * 1000;

class ModerationCache {
    private readonly entries = new Map<string, CacheEntry>();
    private readonly hitEvents: TimedEvent[] = [];
    private readonly missEvents: TimedEvent[] = [];

    constructor(
        private readonly ttlMs: number,
        private readonly capacity = DEFAULT_CACHE_CAPACITY
    ) {}

    get(text: string, context?: string): InternalModerationResult | null {
        const key = createModerationCacheKey(text, context);
        const now = Date.now();
        const entry = this.entries.get(key);

        if (!entry) {
            this.recordMiss(now);
            return null;
        }

        if (entry.expiresAt <= now) {
            this.entries.delete(key);
            this.recordMiss(now);
            return null;
        }

        this.entries.delete(key);
        this.entries.set(key, entry);
        this.recordHit(now);
        return entry.value;
    }

    set(text: string, result: InternalModerationResult, context?: string): void {
        const key = createModerationCacheKey(text, context);
        const entry: CacheEntry = {
            value: result,
            expiresAt: Date.now() + this.ttlMs,
            matchedTermsSignature: result.matchedTerms.join('|').toLowerCase()
        };

        this.entries.delete(key);
        this.entries.set(key, entry);
        this.evictIfNeeded();
    }

    invalidateAll(): void {
        this.entries.clear();
    }

    invalidateByTermPattern(pattern: string): void {
        const normalizedPattern = pattern.trim().toLowerCase();
        if (normalizedPattern.length === 0) return;

        for (const [key, entry] of this.entries.entries()) {
            if (entry.matchedTermsSignature.includes(normalizedPattern)) {
                this.entries.delete(key);
            }
        }
    }

    getHealthSnapshot(): {
        cacheSize: number;
        hitRatioLastHour: number;
        hitsLastHour: number;
        missesLastHour: number;
    } {
        const now = Date.now();
        const hitsLastHour = this.countRecent(this.hitEvents, now, ONE_HOUR_MS);
        const missesLastHour = this.countRecent(this.missEvents, now, ONE_HOUR_MS);
        const total = hitsLastHour + missesLastHour;

        return {
            cacheSize: this.entries.size,
            hitRatioLastHour: total === 0 ? 0 : hitsLastHour / total,
            hitsLastHour,
            missesLastHour
        };
    }

    private evictIfNeeded(): void {
        while (this.entries.size > this.capacity) {
            const oldestKey = this.entries.keys().next().value;
            if (!oldestKey) return;
            this.entries.delete(oldestKey);
        }
    }

    private recordHit(timestamp: number): void {
        this.hitEvents.push({ timestamp });
        this.pruneEvents(this.hitEvents, timestamp);
    }

    private recordMiss(timestamp: number): void {
        this.missEvents.push({ timestamp });
        this.pruneEvents(this.missEvents, timestamp);
    }

    private pruneEvents(events: TimedEvent[], now: number): void {
        const threshold = now - ONE_HOUR_MS;
        while (events.length > 0 && events[0] && events[0].timestamp < threshold) {
            events.shift();
        }
    }

    private countRecent(events: TimedEvent[], now: number, windowMs: number): number {
        const threshold = now - windowMs;
        return events.filter((event) => event.timestamp >= threshold).length;
    }
}

/**
 * Derives a cache key from `text` and an optional `context`.
 *
 * A null-byte (`\0`) is used as separator so that context-scoped term lists
 * produce distinct keys and prevent cross-context cache poisoning.
 */
export function createModerationCacheKey(text: string, context?: string): string {
    const raw = context !== undefined ? `${text}\0${context}` : text;
    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

let moderationCache: ModerationCache | null = null;

export function initializeModerationCache(ttlSeconds: number): void {
    moderationCache = new ModerationCache(ttlSeconds * 1000);
}

export function getCachedModerationResult(
    text: string,
    context?: string
): InternalModerationResult | null {
    return moderationCache?.get(text, context) ?? null;
}

export function setCachedModerationResult(
    text: string,
    result: InternalModerationResult,
    context?: string
): void {
    moderationCache?.set(text, result, context);
}

export function invalidateModerationCache(): void {
    moderationCache?.invalidateAll();
}

export function invalidateModerationCacheByTermPattern(pattern: string): void {
    moderationCache?.invalidateByTermPattern(pattern);
}

export function getModerationCacheHealth(): {
    cacheSize: number;
    hitRatioLastHour: number;
    hitsLastHour: number;
    missesLastHour: number;
} {
    return (
        moderationCache?.getHealthSnapshot() ?? {
            cacheSize: 0,
            hitRatioLastHour: 0,
            hitsLastHour: 0,
            missesLastHour: 0
        }
    );
}
