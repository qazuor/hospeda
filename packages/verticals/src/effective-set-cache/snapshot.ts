import { AggregationStrategySchema, getCatalogKey, VerticalEnumSchema } from '@repo/schemas';
import {
    type ResolvedEffectiveSet,
    type ResolveEffectiveSetArgs,
    resolveEffectiveSet
} from '../effective-set/resolve-effective-set';
import { type ScopedKeyValues, scopeKeyValues } from '../effective-set/scope';
import type { SourceGrant } from '../effective-set/types';
import { decodeFiniteOrInfinite, encodeFiniteOrInfinite } from './number-codec';
import type { EffectiveSetCodec } from './types';

export interface EffectiveSetSnapshot extends ResolvedEffectiveSet {
    readonly version: 1;
}

/** JSON codec for the raw, enumerable user + vertical values. */
export const effectiveSetSnapshotCodec: EffectiveSetCodec<EffectiveSetSnapshot> = {
    encode(snapshot) {
        return JSON.stringify({
            ...snapshot,
            entries: snapshot.entries.map((entry) => ({
                ...entry,
                value: encodeFiniteOrInfinite(entry.value)
            }))
        });
    },
    decode(raw) {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null)
            throw new TypeError('Invalid effective-set snapshot');
        const item = parsed as Record<string, unknown>;
        if (
            item.version !== 1 ||
            typeof item.userId !== 'string' ||
            !VerticalEnumSchema.safeParse(item.vertical).success ||
            typeof item.hasLiveNonTrialTitle !== 'boolean' ||
            !Array.isArray(item.entries)
        )
            throw new TypeError('Invalid effective-set snapshot');
        const entries: SourceGrant[] = item.entries.map((rawEntry: unknown) => {
            if (typeof rawEntry !== 'object' || rawEntry === null)
                throw new TypeError('Invalid effective-set entry');
            const entry = rawEntry as Record<string, unknown>;
            if (typeof entry.key !== 'string') throw new TypeError('Invalid effective-set key');
            return {
                key: entry.key,
                value: decodeFiniteOrInfinite(entry.value),
                strategy: AggregationStrategySchema.parse(entry.strategy)
            };
        });
        return {
            version: 1,
            userId: item.userId,
            vertical: VerticalEnumSchema.parse(item.vertical),
            hasLiveNonTrialTitle: item.hasLiveNonTrialTitle,
            entries
        };
    }
};

export interface RehydratedEffectiveSet {
    readonly userId: string;
    readonly vertical: EffectiveSetSnapshot['vertical'];
    readonly hasLiveNonTrialTitle: boolean;
    readonly entitlements: ScopedKeyValues;
    readonly limits: ScopedKeyValues;
}

/** Rebuilds two scoped readers; no flat values escape the snapshot boundary. */
export function rehydrateEffectiveSet(snapshot: EffectiveSetSnapshot): RehydratedEffectiveSet {
    const entitlements = new Map<string, number>();
    const limits = new Map<string, number>();
    for (const entry of snapshot.entries) {
        const kind = getCatalogKey({ key: entry.key })?.kind;
        if (kind === 'entitlement') entitlements.set(entry.key, entry.value);
        if (kind === 'limit') limits.set(entry.key, entry.value);
    }
    return {
        userId: snapshot.userId,
        vertical: snapshot.vertical,
        hasLiveNonTrialTitle: snapshot.hasLiveNonTrialTitle,
        entitlements: scopeKeyValues({
            values: entitlements,
            userId: snapshot.userId,
            vertical: snapshot.vertical
        }),
        limits: scopeKeyValues({
            values: limits,
            userId: snapshot.userId,
            vertical: snapshot.vertical
        })
    };
}

/** Reads through Redis and rejects a snapshot bound to another identity. */
export async function readEffectiveSet(
    args: ResolveEffectiveSetArgs & {
        readonly cache: {
            readThrough(input: {
                readonly userId: string;
                readonly vertical: string;
                readonly load: () => Promise<EffectiveSetSnapshot>;
            }): Promise<EffectiveSetSnapshot>;
        };
    }
): Promise<RehydratedEffectiveSet> {
    const load = async (): Promise<EffectiveSetSnapshot> => ({
        version: 1,
        ...(await resolveEffectiveSet(args))
    });
    const snapshot = await args.cache.readThrough({
        userId: args.userId,
        vertical: args.vertical,
        load
    });
    return rehydrateEffectiveSet(
        snapshot.userId === args.userId && snapshot.vertical === args.vertical
            ? snapshot
            : await load()
    );
}
