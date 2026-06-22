/**
 * Social Automation catalog seed (SPEC-254 T-015).
 *
 * Seeds all static catalog data required by the social media publish pipeline:
 *   1. Platforms         — social_platforms (3 rows, unique on platform enum)
 *   2. Platform formats  — social_platform_formats (13 rows, unique on platform+publish_format)
 *   3. Settings          — social_settings (7 rows, unique on key)
 *   4. Campaign          — social_campaigns (1 default row, unique on slug)
 *   5. Content batch     — social_content_batches (1 default row, unique on slug)
 *   6. Footer            — social_post_footers (1 default row, unique on slug)
 *   7. Hashtag sets      — social_hashtag_sets (7 rows, unique on slug)
 *   8. Hashtags          — social_hashtags (38 rows, unique on normalized_hashtag)
 *
 * ## Why model-direct (no services)
 *
 * All catalog services (`SocialPlatformFormatService`, `SocialSettingService`,
 * and all catalog CRUD services) gate `_canCreate` on specific permissions that
 * may not be present in the seed super-admin actor JSON at the time this seed runs
 * (the JSON is populated by `rolePermissions.seed.ts` which runs before this seed,
 * but `getSuperAdminActor()` reads from the JSON file, not the live DB). More
 * critically, `SocialPlatformFormatService._canCreate` ALWAYS throws FORBIDDEN —
 * platform-format rows are explicitly seed-only and blocked from API creation.
 * Seeding via model directly (same as `revalidationConfig.seed.ts` and
 * `contentModeration.seed.ts`) is the correct approach for config/catalog data.
 *
 * ## Idempotency
 *
 * Every entity is looked up by its unique key before insert. If the row already
 * exists the seed skips it without error, making the seed safe to re-run.
 *
 * @module seed/required/socialAutomation
 */

import {
    SocialAudienceModel,
    SocialCampaignModel,
    SocialContentBatchModel,
    SocialHashtagModel,
    SocialHashtagSetModel,
    SocialPlatformFormatModel,
    SocialPlatformModel,
    SocialPostFooterModel,
    SocialSettingModel
} from '@repo/db';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

// ---------------------------------------------------------------------------
// Type aliases (avoid importing full schema types into seed layer)
// ---------------------------------------------------------------------------

type InsertSocialPlatform = {
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'X';
    label: string;
    enabled: boolean;
    notes?: string;
};

type InsertSocialPlatformFormat = {
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'X';
    publishFormat:
        | 'FEED_POST'
        | 'PHOTO_POST'
        | 'TEXT_POST'
        | 'IMAGE_POST'
        | 'VIDEO_POST'
        | 'REEL'
        | 'STORY'
        | 'CAROUSEL';
    mediaType: 'IMAGE' | 'VIDEO' | 'NONE';
    enabled: boolean;
    mvpEnabled: boolean;
    makeChannelKey?: string;
    requiresMedia: boolean;
    requiresPublicUrl: boolean;
    maxCaptionLength?: number;
    recommendedRatio?: string;
    recommendedSize?: string;
    notes?: string;
};

type InsertSocialSetting = {
    key: string;
    value: string;
    type: string;
    active: boolean;
    description?: string;
};

type InsertSocialCampaign = {
    name: string;
    slug: string;
    description?: string;
    active: boolean;
};

type InsertSocialContentBatch = {
    name: string;
    slug: string;
    description?: string;
    active: boolean;
};

type InsertSocialPostFooter = {
    name: string;
    slug: string;
    content: string;
    active: boolean;
    isDefault: boolean;
    priority: number;
    notes?: string;
};

type InsertSocialHashtagSet = {
    name: string;
    slug: string;
    hashtagsText: string;
    priority: number;
    active: boolean;
    notes?: string;
};

type InsertSocialHashtag = {
    hashtag: string;
    normalizedHashtag: string;
    category: string;
    priority: number;
    active: boolean;
};

// ---------------------------------------------------------------------------
// Static catalog data
// ---------------------------------------------------------------------------

const PLATFORMS: InsertSocialPlatform[] = [
    { platform: 'INSTAGRAM', label: 'Instagram', enabled: true },
    { platform: 'FACEBOOK', label: 'Facebook', enabled: true },
    { platform: 'X', label: 'X (Twitter)', enabled: true }
];

/**
 * Platform-format catalog.
 *
 * 13 rows total — one per unique (platform, publishFormat) combo per the
 * `social_platform_formats` UNIQUE constraint on (platform, publish_format).
 *
 * INSTAGRAM STORY and FACEBOOK STORY support both IMAGE and VIDEO media but
 * the unique index allows only one row per format. We use IMAGE as the
 * canonical media_type for STORY rows (the most common dispatch path). The
 * make_channel_key encodes the canonical media type for Make.com routing.
 */
const PLATFORM_FORMATS: InsertSocialPlatformFormat[] = [
    // ---- Instagram (5 rows) ----
    {
        platform: 'INSTAGRAM',
        publishFormat: 'FEED_POST',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: true,
        makeChannelKey: 'instagram_feed_image',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 2200,
        recommendedRatio: '1:1',
        recommendedSize: '1080x1080'
    },
    {
        platform: 'INSTAGRAM',
        publishFormat: 'REEL',
        mediaType: 'VIDEO',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'instagram_reel_video',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 2200,
        recommendedRatio: '9:16',
        recommendedSize: '1080x1920'
    },
    {
        platform: 'INSTAGRAM',
        publishFormat: 'STORY',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'instagram_story_image',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 0,
        recommendedRatio: '9:16',
        recommendedSize: '1080x1920'
    },
    {
        platform: 'INSTAGRAM',
        publishFormat: 'CAROUSEL',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'instagram_carousel_image',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 2200,
        recommendedRatio: '1:1',
        recommendedSize: '1080x1080'
    },
    // ---- Facebook (5 rows) ----
    {
        platform: 'FACEBOOK',
        publishFormat: 'FEED_POST',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: true,
        makeChannelKey: 'facebook_feed_image',
        requiresMedia: false,
        requiresPublicUrl: false,
        maxCaptionLength: 63206
    },
    {
        platform: 'FACEBOOK',
        publishFormat: 'PHOTO_POST',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: true,
        makeChannelKey: 'facebook_photo_image',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 63206
    },
    {
        platform: 'FACEBOOK',
        publishFormat: 'VIDEO_POST',
        mediaType: 'VIDEO',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'facebook_video_video',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 63206
    },
    {
        platform: 'FACEBOOK',
        publishFormat: 'REEL',
        mediaType: 'VIDEO',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'facebook_reel_video',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 2200
    },
    {
        platform: 'FACEBOOK',
        publishFormat: 'STORY',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'facebook_story_image',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 0
    },
    // ---- X / Twitter (3 rows) ----
    {
        platform: 'X',
        publishFormat: 'TEXT_POST',
        mediaType: 'NONE',
        enabled: true,
        mvpEnabled: true,
        makeChannelKey: 'x_text_none',
        requiresMedia: false,
        requiresPublicUrl: false,
        maxCaptionLength: 280
    },
    {
        platform: 'X',
        publishFormat: 'IMAGE_POST',
        mediaType: 'IMAGE',
        enabled: true,
        mvpEnabled: true,
        makeChannelKey: 'x_image_image',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 280
    },
    {
        platform: 'X',
        publishFormat: 'VIDEO_POST',
        mediaType: 'VIDEO',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'x_video_video',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 280
    }
    // Total: 4 IG + 5 FB + 3 X = 12 rows
    // (IG STORY VIDEO variant is skipped — unique on (platform, publish_format))
];

const SETTINGS: InsertSocialSetting[] = [
    {
        key: 'default_timezone',
        value: 'America/Argentina/Cordoba',
        type: 'string',
        active: true,
        description: 'Default timezone for scheduling social posts'
    },
    {
        key: 'default_campaign_slug',
        value: 'institucional-hospeda',
        type: 'string',
        active: true,
        description: 'Default campaign slug pre-filled in GPT draft submissions'
    },
    {
        key: 'default_batch_slug',
        value: 'hospeda-launch-2026-06',
        type: 'string',
        active: true,
        description: 'Default content batch slug pre-filled in GPT draft submissions'
    },
    {
        key: 'max_hashtags_instagram',
        value: '30',
        type: 'number',
        active: true,
        description: 'Maximum number of hashtags for Instagram posts'
    },
    {
        key: 'max_hashtags_facebook',
        value: '10',
        type: 'number',
        active: true,
        description: 'Maximum number of hashtags for Facebook posts'
    },
    {
        key: 'max_hashtags_x',
        value: '5',
        type: 'number',
        active: true,
        description: 'Maximum number of hashtags for X (Twitter) posts'
    },
    {
        key: 'make_webhook_url',
        value: '',
        type: 'secret',
        active: true,
        description:
            'Make.com webhook URL used by the dispatch cron to push posts. Must be set before publishing.'
    }
];

const CAMPAIGN: InsertSocialCampaign = {
    name: 'Institucional Hospeda',
    slug: 'institucional-hospeda',
    description:
        'Campaña institucional permanente de Hospeda — contenido de marca y turismo del Litoral',
    active: true
};

const CONTENT_BATCH: InsertSocialContentBatch = {
    name: 'Hospeda Launch 2026-06',
    slug: 'hospeda-launch-2026-06',
    description: 'Sprint de publicaciones de lanzamiento — junio 2026',
    active: true
};

const FOOTER: InsertSocialPostFooter = {
    name: 'Hospeda',
    slug: 'hospeda',
    content: 'Descubri alojamientos en el Litoral Argentino en hospeda.com.ar',
    active: true,
    isDefault: true,
    priority: 0,
    notes: 'Footer institucional por defecto para todos los posts'
};

const HASHTAG_SETS: InsertSocialHashtagSet[] = [
    {
        name: 'General Hospeda',
        slug: 'general-hospeda',
        hashtagsText: '#Hospeda #Turismo #LitoralArgentino #EntreRios #ArgentinaTurismo',
        priority: 0,
        active: true,
        notes: 'Set de hashtags de marca general'
    },
    {
        name: 'Turistas',
        slug: 'turistas',
        hashtagsText: '#Turismo #Viajes #ViajesArgentina #TurismoNacional #Argentina',
        priority: 1,
        active: true,
        notes: 'Para contenido orientado a turistas nacionales'
    },
    {
        name: 'Destinos',
        slug: 'destinos',
        hashtagsText:
            '#Destinos #LitoralArgentino #EntreRios #ConcepcionDelUruguay #CostaArgentina',
        priority: 2,
        active: true,
        notes: 'Para contenido de destinos del Litoral'
    },
    {
        name: 'Alojamientos',
        slug: 'alojamientos',
        hashtagsText: '#Alojamiento #HospedajeArgentina #Cabanas #Hoteles #Hospedaje',
        priority: 3,
        active: true,
        notes: 'Para contenido de alojamientos'
    },
    {
        name: 'Gastronomia',
        slug: 'gastronomia',
        hashtagsText: '#Gastronomia #ComidasArgentinas #RestaurantesArgentina #FoodArgentina',
        priority: 4,
        active: true,
        notes: 'Para contenido gastronomico'
    },
    {
        name: 'Servicios turisticos',
        slug: 'servicios-turisticos',
        hashtagsText: '#ServiciosTuristicos #ExperienciasArgentina #ActividadesArgentina #Aventura',
        priority: 5,
        active: true,
        notes: 'Para contenido de experiencias y servicios'
    },
    {
        name: 'X corto',
        slug: 'x-corto',
        hashtagsText: '#Hospeda #Turismo #LitoralArgentino',
        priority: 6,
        active: true,
        notes: 'Set reducido para X (Twitter) — max 5 hashtags'
    }
];

const HASHTAGS: InsertSocialHashtag[] = [
    // Brand
    {
        hashtag: '#Hospeda',
        normalizedHashtag: '#hospeda',
        category: 'brand',
        priority: 0,
        active: true
    },
    // Tourism general
    {
        hashtag: '#Turismo',
        normalizedHashtag: '#turismo',
        category: 'tourism',
        priority: 1,
        active: true
    },
    {
        hashtag: '#LitoralArgentino',
        normalizedHashtag: '#litoralargentino',
        category: 'destination',
        priority: 2,
        active: true
    },
    {
        hashtag: '#EntreRios',
        normalizedHashtag: '#entrerios',
        category: 'destination',
        priority: 3,
        active: true
    },
    {
        hashtag: '#ArgentinaTurismo',
        normalizedHashtag: '#argentinaturismo',
        category: 'tourism',
        priority: 4,
        active: true
    },
    {
        hashtag: '#Viajes',
        normalizedHashtag: '#viajes',
        category: 'tourism',
        priority: 5,
        active: true
    },
    {
        hashtag: '#ViajesArgentina',
        normalizedHashtag: '#viajesargentina',
        category: 'tourism',
        priority: 6,
        active: true
    },
    {
        hashtag: '#TurismoNacional',
        normalizedHashtag: '#turismonacional',
        category: 'tourism',
        priority: 7,
        active: true
    },
    {
        hashtag: '#Argentina',
        normalizedHashtag: '#argentina',
        category: 'destination',
        priority: 8,
        active: true
    },
    // Destinations
    {
        hashtag: '#ConcepcionDelUruguay',
        normalizedHashtag: '#concepciondeluruguay',
        category: 'destination',
        priority: 9,
        active: true
    },
    {
        hashtag: '#Colon',
        normalizedHashtag: '#colon',
        category: 'destination',
        priority: 10,
        active: true
    },
    {
        hashtag: '#Gualeguaychu',
        normalizedHashtag: '#gualeguaychu',
        category: 'destination',
        priority: 11,
        active: true
    },
    {
        hashtag: '#CostaArgentina',
        normalizedHashtag: '#costaargentina',
        category: 'destination',
        priority: 12,
        active: true
    },
    {
        hashtag: '#Destinos',
        normalizedHashtag: '#destinos',
        category: 'destination',
        priority: 13,
        active: true
    },
    {
        hashtag: '#NaturalezaArgentina',
        normalizedHashtag: '#naturalezaargentina',
        category: 'nature',
        priority: 14,
        active: true
    },
    {
        hashtag: '#NaturalezaEntreRios',
        normalizedHashtag: '#naturalezaentrerios',
        category: 'nature',
        priority: 15,
        active: true
    },
    // Accommodation
    {
        hashtag: '#Alojamiento',
        normalizedHashtag: '#alojamiento',
        category: 'accommodation',
        priority: 16,
        active: true
    },
    {
        hashtag: '#HospedajeArgentina',
        normalizedHashtag: '#hospedajeargentina',
        category: 'accommodation',
        priority: 17,
        active: true
    },
    {
        hashtag: '#Cabanas',
        normalizedHashtag: '#cabanas',
        category: 'accommodation',
        priority: 18,
        active: true
    },
    {
        hashtag: '#Hoteles',
        normalizedHashtag: '#hoteles',
        category: 'accommodation',
        priority: 19,
        active: true
    },
    {
        hashtag: '#Hospedaje',
        normalizedHashtag: '#hospedaje',
        category: 'accommodation',
        priority: 20,
        active: true
    },
    {
        hashtag: '#CasasRurales',
        normalizedHashtag: '#casasrurales',
        category: 'accommodation',
        priority: 21,
        active: true
    },
    {
        hashtag: '#EcoTurismo',
        normalizedHashtag: '#ecoturismo',
        category: 'nature',
        priority: 22,
        active: true
    },
    // Gastronomy
    {
        hashtag: '#Gastronomia',
        normalizedHashtag: '#gastronomia',
        category: 'gastronomy',
        priority: 23,
        active: true
    },
    {
        hashtag: '#ComidasArgentinas',
        normalizedHashtag: '#comidasargentinas',
        category: 'gastronomy',
        priority: 24,
        active: true
    },
    {
        hashtag: '#RestaurantesArgentina',
        normalizedHashtag: '#restaurantesargentina',
        category: 'gastronomy',
        priority: 25,
        active: true
    },
    {
        hashtag: '#FoodArgentina',
        normalizedHashtag: '#foodargentina',
        category: 'gastronomy',
        priority: 26,
        active: true
    },
    // Services / experiences
    {
        hashtag: '#ServiciosTuristicos',
        normalizedHashtag: '#serviciostristicos',
        category: 'services',
        priority: 27,
        active: true
    },
    {
        hashtag: '#ExperienciasArgentina',
        normalizedHashtag: '#experienciasargentina',
        category: 'services',
        priority: 28,
        active: true
    },
    {
        hashtag: '#ActividadesArgentina',
        normalizedHashtag: '#actividadesargentina',
        category: 'services',
        priority: 29,
        active: true
    },
    {
        hashtag: '#Aventura',
        normalizedHashtag: '#aventura',
        category: 'services',
        priority: 30,
        active: true
    },
    {
        hashtag: '#Camping',
        normalizedHashtag: '#camping',
        category: 'services',
        priority: 31,
        active: true
    },
    // Seasonal / lifestyle
    {
        hashtag: '#FinDeSemana',
        normalizedHashtag: '#findesemana',
        category: 'lifestyle',
        priority: 32,
        active: true
    },
    {
        hashtag: '#VacacionesArgentina',
        normalizedHashtag: '#vacacionesargentina',
        category: 'tourism',
        priority: 33,
        active: true
    },
    {
        hashtag: '#Escape',
        normalizedHashtag: '#escape',
        category: 'lifestyle',
        priority: 34,
        active: true
    },
    {
        hashtag: '#Relax',
        normalizedHashtag: '#relax',
        category: 'lifestyle',
        priority: 35,
        active: true
    },
    // Specific features
    {
        hashtag: '#Termas',
        normalizedHashtag: '#termas',
        category: 'destination',
        priority: 36,
        active: true
    },
    {
        hashtag: '#PlayasRio',
        normalizedHashtag: '#playasrio',
        category: 'destination',
        priority: 37,
        active: true
    }
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Logs a skip message when a record already exists.
 */
function logSkip(entity: string, key: string): void {
    logger.info(`  ${entity} "${key}" already exists, skipping`);
}

// ---------------------------------------------------------------------------
// Individual seeders
// ---------------------------------------------------------------------------

/**
 * Seeds the 3 social platform config rows.
 * Idempotent: skips rows where `platform` already exists.
 */
async function seedSocialPlatforms(): Promise<void> {
    const model = new SocialPlatformModel();
    let created = 0;
    let skipped = 0;

    for (const row of PLATFORMS) {
        const existing = await model.findOne({ platform: row.platform });
        if (existing) {
            logSkip('SocialPlatform', row.platform);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialPlatform "${row.platform}" created`);
        created++;
        summaryTracker.trackSuccess('SocialPlatform');
    }

    logger.success({
        msg: `SocialPlatforms seeded: ${created} created, ${skipped} already existed`
    });
}

/**
 * Seeds the platform-format config rows (12 unique combos).
 *
 * The unique key is `(platform, publish_format)` per the DB schema. Where the
 * spec lists STORY with both IMAGE and VIDEO, we seed a single STORY row with
 * IMAGE as the canonical mediaType (most common dispatch path). The
 * make_channel_key encodes the canonical media type for Make.com routing.
 *
 * Idempotent: skips rows where `(platform, publishFormat)` already exists.
 */
async function seedSocialPlatformFormats(): Promise<void> {
    const model = new SocialPlatformFormatModel();
    let created = 0;
    let skipped = 0;

    for (const row of PLATFORM_FORMATS) {
        const existing = await model.findOne({
            platform: row.platform,
            publishFormat: row.publishFormat
        });
        if (existing) {
            logSkip('SocialPlatformFormat', `${row.platform}/${row.publishFormat}`);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialPlatformFormat "${row.platform}/${row.publishFormat}" created`);
        created++;
        summaryTracker.trackSuccess('SocialPlatformFormat');
    }

    logger.success({
        msg: `SocialPlatformFormats seeded: ${created} created, ${skipped} already existed`
    });
}

/**
 * Seeds the social settings key-value store.
 * Idempotent: skips rows where `key` already exists.
 */
async function seedSocialSettings(): Promise<void> {
    const model = new SocialSettingModel();
    let created = 0;
    let skipped = 0;

    for (const row of SETTINGS) {
        const existing = await model.findOne({ key: row.key });
        if (existing) {
            logSkip('SocialSetting', row.key);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialSetting "${row.key}" created`);
        created++;
        summaryTracker.trackSuccess('SocialSetting');
    }

    logger.success({
        msg: `SocialSettings seeded: ${created} created, ${skipped} already existed`
    });
}

/**
 * Seeds the default social campaign.
 * Idempotent: skips if slug already exists.
 */
async function seedSocialCampaign(): Promise<void> {
    const model = new SocialCampaignModel();
    const existing = await model.findOne({ slug: CAMPAIGN.slug });
    if (existing) {
        logSkip('SocialCampaign', CAMPAIGN.slug);
        return;
    }
    await model.create(CAMPAIGN);
    logger.info(`  SocialCampaign "${CAMPAIGN.slug}" created`);
    summaryTracker.trackSuccess('SocialCampaign');
    logger.success({ msg: 'SocialCampaign seeded: 1 created' });
}

/**
 * Seeds the default social content batch.
 * Idempotent: skips if slug already exists.
 */
async function seedSocialContentBatch(): Promise<void> {
    const model = new SocialContentBatchModel();
    const existing = await model.findOne({ slug: CONTENT_BATCH.slug });
    if (existing) {
        logSkip('SocialContentBatch', CONTENT_BATCH.slug);
        return;
    }
    await model.create(CONTENT_BATCH);
    logger.info(`  SocialContentBatch "${CONTENT_BATCH.slug}" created`);
    summaryTracker.trackSuccess('SocialContentBatch');
    logger.success({ msg: 'SocialContentBatch seeded: 1 created' });
}

/**
 * Seeds the default social post footer.
 * Idempotent: skips if slug already exists.
 */
async function seedSocialFooter(): Promise<void> {
    const model = new SocialPostFooterModel();
    const existing = await model.findOne({ slug: FOOTER.slug });
    if (existing) {
        logSkip('SocialPostFooter', FOOTER.slug);
        return;
    }
    await model.create(FOOTER);
    logger.info(`  SocialPostFooter "${FOOTER.slug}" created`);
    summaryTracker.trackSuccess('SocialPostFooter');
    logger.success({ msg: 'SocialPostFooter seeded: 1 created' });
}

/**
 * Seeds the default audience descriptors.
 *
 * Audiences are referenced by hashtags in the catalog. We seed a minimal set
 * here; more audiences can be added through the admin UI.
 * Idempotent: skips if slug already exists.
 */
async function seedSocialAudiences(): Promise<void> {
    const model = new SocialAudienceModel();

    const audiences = [
        {
            name: 'Turistas',
            slug: 'turistas',
            description: 'Turistas nacionales que buscan destinos en el Litoral',
            active: true
        },
        {
            name: 'Familias',
            slug: 'familias',
            description: 'Familias con niños buscando alojamientos y actividades',
            active: true
        },
        {
            name: 'Parejas',
            slug: 'parejas',
            description: 'Parejas buscando escapadas romanticas',
            active: true
        },
        {
            name: 'Aventureros',
            slug: 'aventureros',
            description: 'Viajeros que buscan actividades al aire libre y aventura',
            active: true
        }
    ];

    let created = 0;
    let skipped = 0;

    for (const audience of audiences) {
        const existing = await model.findOne({ slug: audience.slug });
        if (existing) {
            logSkip('SocialAudience', audience.slug);
            skipped++;
            continue;
        }
        await model.create(audience);
        logger.info(`  SocialAudience "${audience.slug}" created`);
        created++;
        summaryTracker.trackSuccess('SocialAudience');
    }

    logger.success({
        msg: `SocialAudiences seeded: ${created} created, ${skipped} already existed`
    });
}

/**
 * Seeds the curated hashtag sets.
 * Idempotent: skips rows where `slug` already exists.
 */
async function seedSocialHashtagSets(): Promise<void> {
    const model = new SocialHashtagSetModel();
    let created = 0;
    let skipped = 0;

    for (const row of HASHTAG_SETS) {
        const existing = await model.findOne({ slug: row.slug });
        if (existing) {
            logSkip('SocialHashtagSet', row.slug);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialHashtagSet "${row.slug}" created`);
        created++;
        summaryTracker.trackSuccess('SocialHashtagSet');
    }

    logger.success({
        msg: `SocialHashtagSets seeded: ${created} created, ${skipped} already existed`
    });
}

/**
 * Seeds the curated hashtag catalog.
 * Idempotent: skips rows where `normalized_hashtag` already exists.
 */
async function seedSocialHashtags(): Promise<void> {
    const model = new SocialHashtagModel();
    let created = 0;
    let skipped = 0;

    for (const row of HASHTAGS) {
        const existing = await model.findOne({ normalizedHashtag: row.normalizedHashtag });
        if (existing) {
            logSkip('SocialHashtag', row.normalizedHashtag);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialHashtag "${row.normalizedHashtag}" created`);
        created++;
        summaryTracker.trackSuccess('SocialHashtag');
    }

    logger.success({
        msg: `SocialHashtags seeded: ${created} created, ${skipped} already existed`
    });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Seeds all social automation catalog data (SPEC-254 T-015).
 *
 * Runs in dependency order:
 *   platforms → platform-formats → settings → campaign → batch
 *   → audiences → footer → hashtag-sets → hashtags
 *
 * All operations are idempotent and safe to re-run.
 *
 * @returns Promise that resolves when all social catalog data is seeded.
 */
export async function seedSocialAutomation(): Promise<void> {
    logger.info('Seeding social automation catalog data (SPEC-254)...');

    try {
        // 1. Platforms (no deps)
        await seedSocialPlatforms();

        // 2. Platform formats (no deps)
        await seedSocialPlatformFormats();

        // 3. Settings (no deps)
        await seedSocialSettings();

        // 4. Campaign (no deps)
        await seedSocialCampaign();

        // 5. Content batch (no deps)
        await seedSocialContentBatch();

        // 6. Audiences (no deps; hashtags may reference them but we seed audiences first)
        await seedSocialAudiences();

        // 7. Footer (no deps)
        await seedSocialFooter();

        // 8. Hashtag sets (no deps)
        await seedSocialHashtagSets();

        // 9. Hashtags (may optionally reference audience_id — we leave it null here)
        await seedSocialHashtags();

        logger.success({ msg: 'Social automation catalog seeded successfully' });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`Error seeding social automation catalog: ${msg}`);
        throw error;
    }
}
