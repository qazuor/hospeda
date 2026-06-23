/**
 * @file catalog.ts
 *
 * GET /api/v1/ai/social/catalog
 *
 * Read-only catalog endpoint consumed by the Custom GPT before drafting.
 * Authenticated via the inbound `x-hospeda-ai-key` API key ONLY — no
 * session, no operator_pin.
 *
 * Implementation note: this endpoint intentionally queries the DB MODELS
 * directly (bypassing the social services) because:
 *  - The synthetic `gpt-action` actor has EMPTY permissions.
 *  - Service list methods gate on permissions (e.g. SOCIAL_HASHTAG_VIEW).
 *  - The API key already authenticated the caller; this is read-only/GPT-safe.
 *
 * @module routes/ai/social/catalog
 * @see SPEC-254 T-026
 */

import {
    socialAudienceModel,
    socialCampaignModel,
    socialContentBatchModel,
    socialHashtagModel,
    socialHashtagSetModel,
    socialPlatformFormatModel,
    socialPostFooterModel,
    socialSettingModel
} from '@repo/db';
import { type CatalogDefaults, SocialCatalogResponseDataSchema } from '@repo/schemas';
import { env } from '../../../utils/env';
import { createApiKeyRoute } from '../../../utils/route-factory-tiered';

// ---------------------------------------------------------------------------
// Setting key constants (mirrors packages/seed/src/required/socialAutomation.seed.ts)
// ---------------------------------------------------------------------------

const SETTING_KEYS = {
    DEFAULT_TIMEZONE: 'default_timezone',
    DEFAULT_CAMPAIGN_SLUG: 'default_campaign_slug',
    DEFAULT_BATCH_SLUG: 'default_batch_slug',
    MAX_HASHTAGS_INSTAGRAM: 'max_hashtags_instagram',
    MAX_HASHTAGS_FACEBOOK: 'max_hashtags_facebook',
    MAX_HASHTAGS_X: 'max_hashtags_x'
} as const;

// ---------------------------------------------------------------------------
// Default fallbacks when a setting row is absent
// ---------------------------------------------------------------------------

const DEFAULT_TIMEZONE = 'America/Argentina/Cordoba';
const DEFAULT_CAMPAIGN_SLUG = '';
const DEFAULT_BATCH_SLUG = '';
const DEFAULT_MAX_HASHTAGS_INSTAGRAM = 30;
const DEFAULT_MAX_HASHTAGS_FACEBOOK = 10;
const DEFAULT_MAX_HASHTAGS_X = 5;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/ai/social/catalog
 *
 * Returns the full GPT-safe catalog:
 *   - hashtags (active only)
 *   - hashtagSets (active only)
 *   - footers (active only)
 *   - platformFormats (enabled only)
 *   - campaigns (active only)
 *   - batches (active only)
 *   - audiences (active only)
 *   - defaults: assembled from social_settings rows
 */
export const socialCatalogRoute = createApiKeyRoute({
    method: 'get',
    path: '/',
    summary: 'GPT social catalog',
    description:
        'Returns the full read-only catalog (hashtags, sets, footers, platform formats, campaigns, batches, audiences, defaults) the Custom GPT fetches before drafting a post.',
    tags: ['AI - Social'],
    apiKeyConfig: {
        headerName: 'x-hospeda-ai-key',
        getExpectedKey: () => env.HOSPEDA_AI_SOCIAL_KEY,
        actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
    },
    responseSchema: SocialCatalogResponseDataSchema,
    handler: async () => {
        // Run all 8 model queries in parallel for minimum latency.
        const [
            hashtagsResult,
            hashtagSetsResult,
            footersResult,
            platformFormatsResult,
            campaignsResult,
            batchesResult,
            audiencesResult,
            settingsResult
        ] = await Promise.all([
            socialHashtagModel.findAll({ active: true }, { pageSize: 200 }),
            socialHashtagSetModel.findAll({ active: true }, { pageSize: 200 }),
            socialPostFooterModel.findAll({ active: true }, { pageSize: 200 }),
            socialPlatformFormatModel.findAll({ enabled: true }, { pageSize: 200 }),
            socialCampaignModel.findAll({ active: true }, { pageSize: 200 }),
            socialContentBatchModel.findAll({ active: true }, { pageSize: 200 }),
            socialAudienceModel.findAll({ active: true }, { pageSize: 200 }),
            socialSettingModel.findAll({}, { pageSize: 50 })
        ]);

        // Build defaults from settings rows
        const settingsMap = new Map<string, string>(
            settingsResult.items.map((s) => [s.key as string, s.value as string])
        );

        const defaults: CatalogDefaults = {
            timezone: settingsMap.get(SETTING_KEYS.DEFAULT_TIMEZONE) ?? DEFAULT_TIMEZONE,
            campaignSlug:
                settingsMap.get(SETTING_KEYS.DEFAULT_CAMPAIGN_SLUG) ?? DEFAULT_CAMPAIGN_SLUG,
            batchSlug: settingsMap.get(SETTING_KEYS.DEFAULT_BATCH_SLUG) ?? DEFAULT_BATCH_SLUG,
            maxHashtagsPerPlatform: {
                INSTAGRAM: Number(
                    settingsMap.get(SETTING_KEYS.MAX_HASHTAGS_INSTAGRAM) ??
                        DEFAULT_MAX_HASHTAGS_INSTAGRAM
                ),
                FACEBOOK: Number(
                    settingsMap.get(SETTING_KEYS.MAX_HASHTAGS_FACEBOOK) ??
                        DEFAULT_MAX_HASHTAGS_FACEBOOK
                ),
                X: Number(settingsMap.get(SETTING_KEYS.MAX_HASHTAGS_X) ?? DEFAULT_MAX_HASHTAGS_X)
            }
        };

        return {
            hashtags: hashtagsResult.items.map((h) => ({
                id: h.id as string,
                hashtag: h.hashtag as string,
                normalizedHashtag: h.normalizedHashtag as string,
                category: h.category as string,
                platform: h.platform as string | undefined,
                audienceId: h.audienceId as string | undefined,
                priority: (h.priority as number) ?? 0,
                active: h.active as boolean
            })),
            hashtagSets: hashtagSetsResult.items.map((s) => ({
                id: s.id as string,
                name: s.name as string,
                slug: s.slug as string,
                platform: s.platform as string | undefined,
                hashtagsText: s.hashtagsText as string,
                priority: (s.priority as number) ?? 0,
                active: s.active as boolean
            })),
            footers: footersResult.items.map((f) => ({
                id: f.id as string,
                name: f.name as string,
                slug: f.slug as string,
                content: f.content as string,
                platform: f.platform as string | undefined,
                active: f.active as boolean,
                isDefault: f.isDefault as boolean,
                priority: (f.priority as number) ?? 0
            })),
            platformFormats: platformFormatsResult.items.map((pf) => ({
                id: pf.id as string,
                platform: pf.platform as string,
                publishFormat: pf.publishFormat as string,
                mediaType: pf.mediaType as string,
                enabled: pf.enabled as boolean,
                mvpEnabled: pf.mvpEnabled as boolean,
                recommendedRatio: pf.recommendedRatio as string | undefined,
                recommendedSize: pf.recommendedSize as string | undefined,
                maxCaptionLength: pf.maxCaptionLength as number | undefined,
                requiresPublicUrl: pf.requiresPublicUrl as boolean,
                requiresMedia: pf.requiresMedia as boolean,
                makeChannelKey: pf.makeChannelKey as string | undefined
            })),
            campaigns: campaignsResult.items.map((c) => ({
                id: c.id as string,
                name: c.name as string,
                slug: c.slug as string,
                description: c.description as string | undefined,
                active: c.active as boolean,
                startsAt: c.startsAt as Date | undefined,
                endsAt: c.endsAt as Date | undefined
            })),
            batches: batchesResult.items.map((b) => ({
                id: b.id as string,
                name: b.name as string,
                slug: b.slug as string,
                description: b.description as string | undefined,
                active: b.active as boolean,
                startsAt: b.startsAt as Date | undefined,
                endsAt: b.endsAt as Date | undefined
            })),
            audiences: audiencesResult.items.map((a) => ({
                id: a.id as string,
                name: a.name as string,
                slug: a.slug as string,
                description: a.description as string | undefined,
                active: a.active as boolean
            })),
            defaults
        };
    }
});
