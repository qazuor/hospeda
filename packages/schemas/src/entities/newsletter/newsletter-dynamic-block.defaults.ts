import { z } from 'zod';
import { NewsletterDynamicSourceEnum } from '../../enums/newsletter-dynamic-source.enum.js';
import { NewsletterIfBelowMinEnum } from '../../enums/newsletter-if-below-min.enum.js';
import type { DynamicBlockConfig } from './newsletter-dynamic-block.schema.js';
import { DynamicBlockConfigSchema } from './newsletter-dynamic-block.schema.js';

/** Required identity and selection fields plus optional values to default. */
export type DynamicBlockDefaultsConfig = Pick<
    DynamicBlockConfig,
    'blockKey' | 'entityType' | 'source' | 'count'
> &
    Partial<Omit<DynamicBlockConfig, 'blockKey' | 'entityType' | 'source' | 'count'>>;

/** Context needed to distinguish an automatic policy from an administrator's choice. */
export interface ApplyDynamicBlockDefaultsInput {
    readonly config: DynamicBlockDefaultsConfig;
    /** Number of dynamic blocks after insertion or removal, including this block. */
    readonly dynamicBlockCount: number;
    /** Keep this flag in editor state; never infer manual intent from the policy value. */
    readonly ifBelowMinManuallyChanged?: boolean;
}

const SOURCE_DEFAULTS = {
    [NewsletterDynamicSourceEnum.NEWEST]: { excludeRecentEditions: 0, fillWithRepeats: false },
    [NewsletterDynamicSourceEnum.MOST_VIEWED]: { excludeRecentEditions: 2, fillWithRepeats: true },
    [NewsletterDynamicSourceEnum.TOP_RATED]: { excludeRecentEditions: 3, fillWithRepeats: true },
    // Featured still fails validation; these placeholders do not enable it.
    [NewsletterDynamicSourceEnum.FEATURED]: { excludeRecentEditions: 0, fillWithRepeats: false }
} as const satisfies Record<
    NewsletterDynamicSourceEnum,
    Pick<DynamicBlockConfig, 'excludeRecentEditions' | 'fillWithRepeats'>
>;

/**
 * Apply source defaults and recalculate automatic below-minimum policies.
 * Call for every remaining block when the document's dynamic block count changes.
 * Explicit dedup and parameter values are preserved, including zero and false.
 *
 * @param input - Block configuration and editor context.
 * @returns A validated configuration, without mutating the input.
 * @throws ZodError when the configuration or dynamic block count is invalid.
 */
export function applyDynamicBlockDefaults(
    input: ApplyDynamicBlockDefaultsInput
): DynamicBlockConfig {
    const { config, ifBelowMinManuallyChanged = false } = input;
    const dynamicBlockCount = z.number().int().min(1).parse(input.dynamicBlockCount);
    const defaults = SOURCE_DEFAULTS[config.source];
    const params = { ...config.params };
    if (config.source === NewsletterDynamicSourceEnum.MOST_VIEWED) {
        params.windowDays ??= 30;
    }
    if (config.source === NewsletterDynamicSourceEnum.TOP_RATED) {
        params.minReviews ??= 3;
    }
    const automaticPolicy =
        dynamicBlockCount === 1
            ? NewsletterIfBelowMinEnum.SKIP_RUN
            : NewsletterIfBelowMinEnum.HIDE_BLOCK;

    return DynamicBlockConfigSchema.parse({
        ...config,
        params,
        minItems: config.minItems ?? 1,
        ifBelowMin: ifBelowMinManuallyChanged
            ? (config.ifBelowMin ?? automaticPolicy)
            : automaticPolicy,
        excludeRecentEditions: config.excludeRecentEditions ?? defaults.excludeRecentEditions,
        fillWithRepeats: config.fillWithRepeats ?? defaults.fillWithRepeats
    });
}
