/**
 * Fixed list of example contexts for the "Effective bar per context" panel.
 * These represent the content entity types that go through moderation.
 */
export const MODERATION_EXAMPLE_CONTEXTS = [
    'message',
    'review',
    'accommodation_review',
    'destination_review'
] as const;

export type ModerationExampleContext = (typeof MODERATION_EXAMPLE_CONTEXTS)[number];

/**
 * Configuration for the moderation thresholds page.
 * Thresholds are update-only (no create); the default row is the only editable row in v1.
 */
export const moderationThresholdsConfig = {
    apiEndpoint: '/api/v1/admin/content-moderation/thresholds',
    basePath: '/content/moderation-thresholds',
    exampleContexts: MODERATION_EXAMPLE_CONTEXTS
};
