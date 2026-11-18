import { UMAMI_BLOCK_SELECTOR } from '../../apps/web/src/lib/analytics/recording-block.js';

/**
 * Session recorder configuration of the WEB website, as code (HOS-2347 §6.8).
 *
 * Umami 3.5 stores it in two `website` columns: `recorder_enabled` and
 * `replay_config`. Measured behaviour (HOS-2347 spike, read from the built
 * server of the staging container):
 *
 * - The only write path is `POST /api/websites/:id` with a `replayConfig`
 *   object. It is MERGED over the stored config, then normalized.
 * - `recorderEnabled` is NOT an input: Umami derives it as
 *   `replayEnabled === true || heatmapEnabled === true`.
 * - Normalization keeps only the seven known keys and drops `false` booleans,
 *   so the stored JSON is sparse. Defaults are applied only by the public
 *   `GET /api/websites/:id/recorder` ({@link UMAMI_RECORDER_DEFAULTS}).
 * - Recording retention is NOT configurable: nothing in Umami deletes replays
 *   except a website reset or delete. See `docs/analytics/session-replay-privacy.md`.
 *
 * Hospeda's own switch (`platform_settings` key `analytics.sessionRecording`)
 * is the operational on/off. This config can stay enabled permanently because
 * the web never loads `recorder.js` while that switch is off.
 */

/** Uniform sample rate for replays AND heatmaps (owner decision; never 1.0). */
export const RECORDER_SAMPLE_RATE = 0.5;

/** Maximum length of one recording, in milliseconds (5 minutes). */
export const RECORDER_MAX_DURATION_MS = 300_000;

/** Mask levels Umami accepts. */
export const MASK_LEVELS = ['strict', 'moderate'] as const;

/** A mask level. */
export type MaskLevel = (typeof MASK_LEVELS)[number];

/** The seven `replay_config` keys Umami 3.5 understands, in display order. */
export const REPLAY_CONFIG_KEYS = [
    'replayEnabled',
    'heatmapEnabled',
    'sampleRate',
    'heatmapSampleRate',
    'maskLevel',
    'maxDuration',
    'blockSelector'
] as const;

/** One `replay_config` key. */
export type ReplayConfigKey = (typeof REPLAY_CONFIG_KEYS)[number];

/** A fully defaulted recorder config (what the recorder GET answers). */
export interface ReplayConfig {
    readonly replayEnabled: boolean;
    readonly heatmapEnabled: boolean;
    readonly sampleRate: number;
    readonly heatmapSampleRate: number;
    readonly maskLevel: MaskLevel;
    readonly maxDuration: number;
    readonly blockSelector: string;
}

/** Defaults Umami 3.5 applies on read to any key absent from `replay_config`. */
export const UMAMI_RECORDER_DEFAULTS: ReplayConfig = {
    replayEnabled: false,
    heatmapEnabled: false,
    sampleRate: 0.15,
    heatmapSampleRate: 0.15,
    maskLevel: 'moderate',
    maxDuration: 300_000,
    blockSelector: ''
};

/**
 * The declared recorder config of the WEB website.
 *
 * @returns Replays and heatmaps on, uniform 0.5 sampling, strict masking,
 *   5-minute cap, and the shared block selector.
 */
export function buildRecorderDefinition(): ReplayConfig {
    return {
        replayEnabled: true,
        heatmapEnabled: true,
        sampleRate: RECORDER_SAMPLE_RATE,
        heatmapSampleRate: RECORDER_SAMPLE_RATE,
        maskLevel: 'strict',
        maxDuration: RECORDER_MAX_DURATION_MS,
        blockSelector: UMAMI_BLOCK_SELECTOR
    };
}

/**
 * Mirrors Umami's own normalization of a stored or submitted `replay_config`:
 * only the seven known keys with a valid type survive, and `false` booleans
 * are dropped.
 *
 * @param input.raw - The stored value (any JSON, or `null`)
 * @returns The sparse, normalized config
 */
export function normalizeReplayConfig(input: { readonly raw: unknown }): Partial<ReplayConfig> {
    const { raw } = input;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const source = raw as Readonly<Record<string, unknown>>;
    const out: { -readonly [K in keyof ReplayConfig]?: ReplayConfig[K] } = {};
    if (source.replayEnabled === true) out.replayEnabled = true;
    if (source.heatmapEnabled === true) out.heatmapEnabled = true;
    if (typeof source.sampleRate === 'number') out.sampleRate = source.sampleRate;
    if (typeof source.heatmapSampleRate === 'number') {
        out.heatmapSampleRate = source.heatmapSampleRate;
    }
    if (source.maskLevel === 'strict' || source.maskLevel === 'moderate') {
        out.maskLevel = source.maskLevel;
    }
    if (typeof source.maxDuration === 'number' && Number.isFinite(source.maxDuration)) {
        out.maxDuration = Math.round(source.maxDuration);
    }
    if (typeof source.blockSelector === 'string') out.blockSelector = source.blockSelector;
    return out;
}

/**
 * Applies {@link UMAMI_RECORDER_DEFAULTS} to a sparse config, as the recorder
 * GET does.
 *
 * @param input.config - A normalized, possibly sparse config
 * @returns The fully defaulted config
 */
export function withRecorderDefaults(input: {
    readonly config: Partial<ReplayConfig>;
}): ReplayConfig {
    return { ...UMAMI_RECORDER_DEFAULTS, ...input.config };
}
