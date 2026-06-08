import {
    MODERATION_PENDING_THRESHOLD,
    MODERATION_REJECT_THRESHOLD
} from '@repo/content-moderation';
import { ContentModerationThresholdModel } from '@repo/db';

export type ResolvedModerationThreshold = {
    readonly context: string;
    readonly pending: number;
    readonly reject: number;
    readonly source: 'row' | 'default-row' | 'code-constants';
};

type CacheEntry = {
    readonly value: ResolvedModerationThreshold;
    readonly expiresAt: number;
};

const THRESHOLD_CACHE_TTL_MS = 60_000;
const thresholdCache = new Map<string, CacheEntry>();

function readFromCache(context: string): ResolvedModerationThreshold | null {
    const entry = thresholdCache.get(context);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
        thresholdCache.delete(context);
        return null;
    }

    return entry.value;
}

function writeToCache(context: string, value: ResolvedModerationThreshold): void {
    thresholdCache.set(context, {
        value,
        expiresAt: Date.now() + THRESHOLD_CACHE_TTL_MS
    });
}

export function invalidateModerationThresholdCache(): void {
    thresholdCache.clear();
}

export async function getThresholdForContext(params: {
    context?: string;
    model?: Pick<ContentModerationThresholdModel, 'findByContext'>;
}): Promise<ResolvedModerationThreshold> {
    const requestedContext = params.context?.trim() || 'default';
    const cached = readFromCache(requestedContext);
    if (cached) return cached;

    const model = params.model ?? new ContentModerationThresholdModel();
    const row = await model.findByContext(requestedContext);

    const resolved: ResolvedModerationThreshold = row
        ? {
              context: row.context,
              pending: row.pending,
              reject: row.reject,
              source: row.context === requestedContext ? 'row' : 'default-row'
          }
        : {
              context: 'default',
              pending: MODERATION_PENDING_THRESHOLD,
              reject: MODERATION_REJECT_THRESHOLD,
              source: 'code-constants'
          };

    writeToCache(requestedContext, resolved);
    return resolved;
}
