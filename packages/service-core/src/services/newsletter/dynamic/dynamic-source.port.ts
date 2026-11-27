import type { Locale } from '@repo/i18n';
import type { DynamicBlockConfig } from '@repo/schemas';

/** Plain-text card content for one locale; only HTTPS images are allowed. */
export interface DynamicCard {
    readonly name: string;
    readonly summary: string;
    readonly imageUrl: string | null;
    readonly url: string;
}

/** Requested locales mapped to their resolved card content. */
export type LocalizedCard = Readonly<Partial<Record<Locale, DynamicCard>>>;

/** An item removed during eligibility revalidation. */
export interface DroppedItem {
    readonly id: string;
    readonly reason: 'not_published' | 'deleted' | 'below_min_reviews' | 'destination_mismatch';
}

/** Ranked candidate request; the caller supplies a stable clock. */
export interface FetchCandidatesInput {
    readonly block: DynamicBlockConfig;
    readonly now: Date;
    readonly excludeIds: readonly string[];
    readonly limit: number;
}

/** Data access needed by the write-free newsletter resolver. */
export interface DynamicSourcePort {
    fetchCandidates(input: FetchCandidatesInput): Promise<readonly string[]>;
    revalidate(input: {
        readonly block: DynamicBlockConfig;
        readonly ids: readonly string[];
        readonly now: Date;
    }): Promise<{ readonly validIds: readonly string[]; readonly dropped: readonly DroppedItem[] }>;
    loadCards(input: {
        readonly ids: readonly string[];
        readonly locales: readonly Locale[];
    }): Promise<ReadonlyMap<string, LocalizedCard>>;
}
