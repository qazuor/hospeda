import type { Locale } from '@repo/i18n';
import type { DynamicBlockConfig, NewsletterDynamicEntityTypeEnum } from '@repo/schemas';
import type { DroppedItem, DynamicSourcePort, LocalizedCard } from './dynamic-source.port.js';

/** One previously sent edition of a block (never a draft). */
export interface BlockHistoryEntry {
    readonly blockKey: string;
    readonly sentAt: Date;
    readonly itemIds: readonly string[];
}

/** Draft selection; manual edits prevent automatic refilling at send time. */
export interface CurrentBlockState {
    readonly itemIds: readonly string[];
    readonly manuallyEdited: boolean;
}

/** Frozen block content, ready for rendering without further data access. */
export interface ResolvedBlock {
    readonly blockKey: string;
    readonly entityType: NewsletterDynamicEntityTypeEnum;
    readonly itemIds: readonly string[];
    readonly repeats: readonly string[];
    readonly hidden: boolean;
    readonly cards: ReadonlyMap<string, LocalizedCard>;
}

/** Diagnostics for one block, including every rejected candidate. */
export interface BlockResolutionReport {
    readonly blockKey: string;
    readonly candidates: readonly string[];
    readonly dropped: readonly DroppedItem[];
    readonly repeatsUsed: number;
    readonly belowMin: boolean;
    readonly action: 'send' | 'skip_run' | 'hide_block' | 'send_anyway';
}

/** Per-block resolution diagnostics. */
export interface ResolutionReport {
    readonly blocks: readonly BlockResolutionReport[];
}

/** Shared inputs for generation, preview and send; this operation never writes. */
export interface ResolveBlocksInput {
    readonly blocks: readonly DynamicBlockConfig[];
    readonly phase: 'generate' | 'send';
    readonly now: Date;
    readonly history: readonly BlockHistoryEntry[];
    readonly current?: ReadonlyMap<string, CurrentBlockState>;
    readonly locales: readonly Locale[];
    readonly port: DynamicSourcePort;
}

/** Aggregate decision and immutable content produced by resolution. */
export interface ResolveBlocksOutput {
    readonly decision: 'send' | 'skip_run';
    readonly blocks: readonly ResolvedBlock[];
    readonly report: ResolutionReport;
}
