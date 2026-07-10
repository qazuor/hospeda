/**
 * Social Automation catalog seed (SPEC-254 T-015).
 *
 * Seeds all static catalog data required by the social media publish pipeline:
 *   1. Platforms         — social_platforms (5 rows, unique on platform enum)
 *   2. Platform formats  — social_platform_formats (15 rows, unique on platform+publish_format)
 *   3. Settings          — social_settings (11 rows, unique on key)
 *   4. Campaigns         — social_campaigns (16 rows, unique on slug)
 *   5. Content batches   — social_content_batches (8 rows, unique on slug)
 *   6. Audiences         — social_audiences (12 rows, unique on slug)
 *   7. Footers           — social_post_footers (6 rows, unique on slug)
 *   8. Hashtag sets      — social_hashtag_sets (18 rows, unique on slug)
 *   9. Hashtags          — social_hashtags (89 rows, unique on normalized_hashtag)
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
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'X' | 'LINKEDIN' | 'TIKTOK';
    label: string;
    enabled: boolean;
    notes?: string;
};

type InsertSocialPlatformFormat = {
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'X' | 'LINKEDIN' | 'TIKTOK';
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
    startsAt?: Date | null;
    endsAt?: Date | null;
};

type InsertSocialContentBatch = {
    name: string;
    slug: string;
    description?: string;
    active: boolean;
    startsAt?: Date | null;
    endsAt?: Date | null;
};

type InsertSocialPostFooter = {
    name: string;
    slug: string;
    content: string;
    active: boolean;
    isDefault: boolean;
    priority: number;
    notes?: string;
    platform?: 'INSTAGRAM' | 'FACEBOOK' | 'X' | 'LINKEDIN' | 'TIKTOK' | null;
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

export const PLATFORMS: InsertSocialPlatform[] = [
    { platform: 'INSTAGRAM', label: 'Instagram', enabled: true },
    { platform: 'FACEBOOK', label: 'Facebook', enabled: true },
    { platform: 'X', label: 'X (Twitter)', enabled: true },
    { platform: 'LINKEDIN', label: 'LinkedIn', enabled: true },
    { platform: 'TIKTOK', label: 'TikTok', enabled: true }
];

/**
 * Platform-format catalog.
 *
 * 15 rows total — one per unique (platform, publishFormat) combo per the
 * `social_platform_formats` UNIQUE constraint on (platform, publish_format).
 *
 * INSTAGRAM STORY and FACEBOOK STORY support both IMAGE and VIDEO media but
 * the unique index allows only one row per format. We use IMAGE as the
 * canonical media_type for STORY rows (the most common dispatch path). The
 * make_channel_key encodes the canonical media type for Make.com routing.
 *
 * LINKEDIN and TIKTOK (HOS-65) have NO STORY row — neither platform supports
 * Stories, per owner decision.
 */
export const PLATFORM_FORMATS: InsertSocialPlatformFormat[] = [
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
    },
    // ---- LinkedIn (2 rows) — no STORY, LinkedIn has no Stories ----
    {
        platform: 'LINKEDIN',
        publishFormat: 'TEXT_POST',
        mediaType: 'NONE',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'linkedin_text_none',
        requiresMedia: false,
        requiresPublicUrl: false,
        maxCaptionLength: 3000
    },
    {
        platform: 'LINKEDIN',
        publishFormat: 'VIDEO_POST',
        mediaType: 'VIDEO',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'linkedin_video_video',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 3000,
        recommendedRatio: '16:9',
        recommendedSize: '1920x1080'
    },
    // ---- TikTok (1 row) — video-first, no STORY, no TEXT_POST ----
    {
        platform: 'TIKTOK',
        publishFormat: 'VIDEO_POST',
        mediaType: 'VIDEO',
        enabled: true,
        mvpEnabled: false,
        makeChannelKey: 'tiktok_video_video',
        requiresMedia: true,
        requiresPublicUrl: false,
        maxCaptionLength: 2200,
        recommendedRatio: '9:16',
        recommendedSize: '1080x1920'
    }
    // Total: 4 IG + 5 FB + 3 X + 2 LinkedIn + 1 TikTok = 15 rows
    // (IG STORY VIDEO variant is skipped — unique on (platform, publish_format))
];

export const SETTINGS: InsertSocialSetting[] = [
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
        key: 'max_retry_count',
        value: '3',
        type: 'number',
        active: true,
        description: 'Maximum number of retry attempts for a failed social-publish dispatch'
    },
    {
        key: 'make_webhook_timeout_ms',
        value: '40000',
        type: 'number',
        active: true,
        description: 'Timeout in milliseconds for the outbound Make.com webhook call'
    },
    {
        key: 'download_timeout_ms',
        value: '15000',
        type: 'number',
        active: true,
        description: 'Timeout in milliseconds for downloading source media before Cloudinary upload'
    },
    {
        key: 'social_assets_folder',
        value: 'hospeda/social',
        type: 'string',
        active: true,
        description:
            'Cloudinary folder BASE PREFIX for processed social media assets. The environment segment and "assets" suffix are always appended by code (e.g. "hospeda/social/prod/assets") and cannot be overridden here — this only controls the prefix.'
    },
    {
        key: 'dispatch_cron_cadence',
        value: '*/5 * * * *',
        type: 'string',
        active: true,
        description: 'Cron expression controlling how often the social dispatch job runs'
    }
];

export const CAMPAIGNS: InsertSocialCampaign[] = [
    {
        name: 'Institucional Hospeda',
        slug: 'institucional-hospeda',
        description:
            'Campaña institucional permanente de Hospeda — contenido de marca y turismo del Litoral',
        active: true
    },
    {
        name: 'Verano en el Litoral 2026-27',
        slug: 'verano-litoral-2026-27',
        description: 'Temporada alta: playas de río, termas y escapadas de verano en el Litoral',
        active: true,
        startsAt: new Date('2026-11-01T00:00:00Z'),
        endsAt: new Date('2027-03-01T00:00:00Z')
    },
    {
        name: 'Carnaval del Litoral',
        slug: 'carnaval-gualeguaychu',
        description: 'El Carnaval del País en Gualeguaychú y el Litoral',
        active: true,
        startsAt: new Date('2026-12-01T00:00:00Z'),
        endsAt: new Date('2027-02-15T00:00:00Z')
    },
    {
        name: 'Semana Santa en el Litoral',
        slug: 'semana-santa-litoral',
        description: 'Escapadas de Semana Santa por el Litoral Argentino',
        active: true,
        startsAt: new Date('2027-02-15T00:00:00Z'),
        endsAt: new Date('2027-03-23T00:00:00Z')
    },
    {
        name: 'Vacaciones de Invierno',
        slug: 'vacaciones-invierno',
        description: 'Termas, cabañas y descanso en las vacaciones de invierno',
        active: true,
        startsAt: new Date('2027-07-01T00:00:00Z'),
        endsAt: new Date('2027-07-31T00:00:00Z')
    },
    {
        name: 'Fiestas de Fin de Año',
        slug: 'fiestas-fin-de-anio',
        description: 'Temporada de regalos y fiestas: Día de la Madre, Navidad, Año Nuevo y Reyes',
        active: true,
        startsAt: new Date('2026-10-01T00:00:00Z'),
        endsAt: new Date('2027-01-06T00:00:00Z')
    },
    {
        name: 'Día de la Madre',
        slug: 'dia-de-la-madre',
        description: 'Escapadas y regalos para mamá',
        active: true,
        startsAt: new Date('2026-10-01T00:00:00Z'),
        endsAt: new Date('2026-10-20T00:00:00Z')
    },
    {
        name: 'Escapadas de Fin de Semana Largo',
        slug: 'escapadas-finde-largo',
        description: 'Contenido para feriados y fines de semana largos, todo el año',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Termas del Litoral',
        slug: 'termas-del-litoral',
        description: 'Termas de Entre Ríos: Federación, Colón, Concordia y Villa Elisa',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Sabores del Litoral',
        slug: 'sabores-del-litoral',
        description: 'Gastronomía regional: pescados de río, chajá y cocina litoraleña',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Pesca en el Río Uruguay',
        slug: 'pesca-rio-uruguay',
        description: 'Pesca deportiva en el Río Uruguay: dorado, surubí y boga',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Naturaleza y Playas del Litoral',
        slug: 'naturaleza-playas-litoral',
        description: 'Playas de río, El Palmar, reservas naturales y ecoturismo',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Fiesta Nacional de la Artesanía',
        slug: 'fiesta-nacional-artesania',
        description: 'Fiesta Nacional de la Artesanía en Colón, Entre Ríos',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Fiesta de la Playa de Río',
        slug: 'fiesta-playa-rio',
        description: 'Fiesta de la Playa de Río en Concepción del Uruguay (Banco Pelay)',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Fiesta Nacional del Lago',
        slug: 'fiesta-nacional-lago',
        description: 'Fiesta Nacional del Lago en Federación, Entre Ríos',
        active: true,
        startsAt: null,
        endsAt: null
    },
    {
        name: 'Fiesta Nacional de la Citricultura',
        slug: 'fiesta-citricultura',
        description: 'Fiesta Nacional de la Citricultura en Concordia, Entre Ríos',
        active: true,
        startsAt: null,
        endsAt: null
    }
];

export const CONTENT_BATCHES: InsertSocialContentBatch[] = [
    {
        name: 'Hospeda Launch 2026-06',
        slug: 'hospeda-launch-2026-06',
        description: 'Sprint de publicaciones de lanzamiento — junio 2026',
        active: true
    },
    {
        name: 'Verano · Enero 2027',
        slug: 'verano-enero-2027',
        description: 'Serie de contenido de verano para enero',
        active: true
    },
    {
        name: 'Verano · Febrero 2027',
        slug: 'verano-febrero-2027',
        description: 'Serie de contenido de verano para febrero',
        active: true
    },
    {
        name: 'Finde Largo Carnaval 2027',
        slug: 'finde-largo-carnaval-2027',
        description: 'Tanda especial para el fin de semana feriado de Carnaval',
        active: true
    },
    {
        name: 'Vacaciones Invierno · Julio 2027',
        slug: 'vacaciones-invierno-julio-2027',
        description: 'Serie de invierno: termas y cabañas',
        active: true
    },
    {
        name: 'Serie Destinos del Litoral',
        slug: 'serie-destinos-litoral',
        description: 'Serie permanente, un destino del Litoral por publicación',
        active: true
    },
    {
        name: 'Alojamientos Destacados',
        slug: 'alojamientos-destacados',
        description: 'Serie rotativa de alojamientos destacados de la plataforma',
        active: true
    },
    {
        name: 'Sabores del Litoral · Serie 2027',
        slug: 'sabores-litoral-2027',
        description: 'Serie gastronómica del Litoral',
        active: true
    }
];

export const FOOTERS: InsertSocialPostFooter[] = [
    {
        name: 'Hospeda',
        slug: 'hospeda',
        content: 'Descubri alojamientos en el Litoral Argentino en hospeda.com.ar',
        active: true,
        isDefault: true,
        priority: 0,
        notes: 'Footer institucional por defecto para todos los posts'
    },
    {
        name: 'Hospeda · Instagram',
        slug: 'hospeda-instagram',
        content:
            '📍 Litoral Argentino · Reservá tu alojamiento en hospeda.com.ar · Seguinos en @hospeda.com.ar',
        active: true,
        isDefault: false,
        priority: 1,
        platform: 'INSTAGRAM'
    },
    {
        name: 'Hospeda · Facebook',
        slug: 'hospeda-facebook',
        content:
            'Descubrí alojamientos en el Litoral Argentino en hospeda.com.ar · Seguinos en facebook.com/hospeda.com.ar',
        active: true,
        isDefault: false,
        priority: 1,
        platform: 'FACEBOOK'
    },
    {
        name: 'Hospeda · X',
        slug: 'hospeda-x',
        content: 'Alojamientos en el Litoral 👉 hospeda.com.ar · @HospedaLitoral',
        active: true,
        isDefault: false,
        priority: 1,
        platform: 'X'
    },
    {
        name: 'Hospeda · TikTok',
        slug: 'hospeda-tiktok',
        content: 'Viví el Litoral Argentino · Reservá en hospeda.com.ar · @hospeda_litoral',
        active: true,
        isDefault: false,
        priority: 1,
        platform: 'TIKTOK'
    },
    {
        name: 'Hospeda · Verano',
        slug: 'hospeda-verano',
        content: '☀️ Viví el verano en el Litoral · Reservá en hospeda.com.ar · #VeranoEnElLitoral',
        active: true,
        isDefault: false,
        priority: 2,
        platform: null
    }
];

export const HASHTAG_SETS: InsertSocialHashtagSet[] = [
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
    },
    {
        name: 'Termas',
        slug: 'termas',
        hashtagsText: '#Termas #TermasDeEntreRios #TurismoTermal #AguasTermales #Bienestar',
        priority: 7,
        active: true
    },
    {
        name: 'Carnaval',
        slug: 'carnaval',
        hashtagsText: '#Carnaval #CarnavalDelPais #CarnavalGualeguaychu #Gualeguaychu #Verano',
        priority: 8,
        active: true
    },
    {
        name: 'Playas de río',
        slug: 'playas-rio',
        hashtagsText: '#PlayasDeRio #RioUruguay #Playa #Sol #Verano',
        priority: 9,
        active: true
    },
    {
        name: 'Pesca',
        slug: 'pesca',
        hashtagsText: '#PescaDeportiva #Dorado #RioUruguay #PescaEnEntreRios',
        priority: 10,
        active: true
    },
    {
        name: 'Naturaleza y ecoturismo',
        slug: 'naturaleza-ecoturismo',
        hashtagsText:
            '#NaturalezaArgentina #EcoTurismo #ParqueNacionalElPalmar #ReservaNatural #Trekking',
        priority: 11,
        active: true
    },
    {
        name: 'Familias',
        slug: 'familias',
        hashtagsText: '#Familia #VacacionesEnFamilia #TurismoFamiliar #Descanso',
        priority: 12,
        active: true
    },
    {
        name: 'Parejas / romántico',
        slug: 'parejas-romantico',
        hashtagsText: '#Escapada #EscapadaRomantica #Relax #Descanso',
        priority: 13,
        active: true
    },
    {
        name: 'Finde largo',
        slug: 'finde-largo',
        hashtagsText: '#FindeLargo #Escapada #Turismo #LitoralArgentino',
        priority: 14,
        active: true
    },
    {
        name: 'Vacaciones de invierno',
        slug: 'vacaciones-invierno',
        hashtagsText: '#VacacionesDeInvierno #Invierno #Termas #Descanso',
        priority: 15,
        active: true
    },
    {
        name: 'Fiestas de fin de año',
        slug: 'fiestas-fin-de-anio',
        hashtagsText: '#Fiestas #Navidad #AnioNuevo #FinDeAnio',
        priority: 16,
        active: true
    },
    {
        name: 'Fiestas del Litoral',
        slug: 'fiestas-litoral',
        hashtagsText:
            '#FiestaDeLaArtesania #FiestaDeLaPlaya #FiestaNacionalDelLago #FiestaDeLaCitricultura #EntreRios',
        priority: 17,
        active: true
    }
];

export const HASHTAGS: InsertSocialHashtag[] = [
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
        normalizedHashtag: '#serviciosturisticos',
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
    },
    // Destinations (Litoral towns)
    {
        hashtag: '#Concordia',
        normalizedHashtag: '#concordia',
        category: 'destination',
        priority: 38,
        active: true
    },
    {
        hashtag: '#Federacion',
        normalizedHashtag: '#federacion',
        category: 'destination',
        priority: 39,
        active: true
    },
    {
        hashtag: '#Chajari',
        normalizedHashtag: '#chajari',
        category: 'destination',
        priority: 40,
        active: true
    },
    {
        hashtag: '#VillaElisa',
        normalizedHashtag: '#villaelisa',
        category: 'destination',
        priority: 41,
        active: true
    },
    {
        hashtag: '#SanJose',
        normalizedHashtag: '#sanjose',
        category: 'destination',
        priority: 42,
        active: true
    },
    {
        hashtag: '#LaPaz',
        normalizedHashtag: '#lapaz',
        category: 'destination',
        priority: 43,
        active: true
    },
    {
        hashtag: '#Victoria',
        normalizedHashtag: '#victoria',
        category: 'destination',
        priority: 44,
        active: true
    },
    {
        hashtag: '#Diamante',
        normalizedHashtag: '#diamante',
        category: 'destination',
        priority: 45,
        active: true
    },
    {
        hashtag: '#Gualeguay',
        normalizedHashtag: '#gualeguay',
        category: 'destination',
        priority: 46,
        active: true
    },
    {
        hashtag: '#ParqueNacionalElPalmar',
        normalizedHashtag: '#parquenacionalelpalmar',
        category: 'destination',
        priority: 47,
        active: true
    },
    // Thermal
    // NOTE: '#Termas' → '#termas' is intentionally NOT re-added here — it
    // collides with the existing row above (priority 36) and would violate
    // the UNIQUE constraint on normalized_hashtag.
    {
        hashtag: '#TermasDeEntreRios',
        normalizedHashtag: '#termasdeentrerios',
        category: 'thermal',
        priority: 48,
        active: true
    },
    {
        hashtag: '#TurismoTermal',
        normalizedHashtag: '#turismotermal',
        category: 'thermal',
        priority: 49,
        active: true
    },
    {
        hashtag: '#AguasTermales',
        normalizedHashtag: '#aguastermales',
        category: 'thermal',
        priority: 50,
        active: true
    },
    {
        hashtag: '#Bienestar',
        normalizedHashtag: '#bienestar',
        category: 'thermal',
        priority: 51,
        active: true
    },
    // Carnaval
    {
        hashtag: '#Carnaval',
        normalizedHashtag: '#carnaval',
        category: 'carnaval',
        priority: 52,
        active: true
    },
    {
        hashtag: '#CarnavalDelPais',
        normalizedHashtag: '#carnavaldelpais',
        category: 'carnaval',
        priority: 53,
        active: true
    },
    {
        hashtag: '#CarnavalGualeguaychu',
        normalizedHashtag: '#carnavalgualeguaychu',
        category: 'carnaval',
        priority: 54,
        active: true
    },
    // Fishing
    {
        hashtag: '#PescaDeportiva',
        normalizedHashtag: '#pescadeportiva',
        category: 'fishing',
        priority: 55,
        active: true
    },
    {
        hashtag: '#Dorado',
        normalizedHashtag: '#dorado',
        category: 'fishing',
        priority: 56,
        active: true
    },
    {
        hashtag: '#RioUruguay',
        normalizedHashtag: '#riouruguay',
        category: 'fishing',
        priority: 57,
        active: true
    },
    {
        hashtag: '#PescaEnEntreRios',
        normalizedHashtag: '#pescaenentrerios',
        category: 'fishing',
        priority: 58,
        active: true
    },
    // Nature
    {
        hashtag: '#PlayasDeRio',
        normalizedHashtag: '#playasderio',
        category: 'nature',
        priority: 59,
        active: true
    },
    {
        hashtag: '#ReservaNatural',
        normalizedHashtag: '#reservanatural',
        category: 'nature',
        priority: 60,
        active: true
    },
    {
        hashtag: '#Playa',
        normalizedHashtag: '#playa',
        category: 'nature',
        priority: 61,
        active: true
    },
    {
        hashtag: '#Sol',
        normalizedHashtag: '#sol',
        category: 'nature',
        priority: 62,
        active: true
    },
    {
        hashtag: '#Verano',
        normalizedHashtag: '#verano',
        category: 'nature',
        priority: 63,
        active: true
    },
    {
        hashtag: '#Kayak',
        normalizedHashtag: '#kayak',
        category: 'nature',
        priority: 64,
        active: true
    },
    {
        hashtag: '#Trekking',
        normalizedHashtag: '#trekking',
        category: 'nature',
        priority: 65,
        active: true
    },
    {
        hashtag: '#Cabalgatas',
        normalizedHashtag: '#cabalgatas',
        category: 'nature',
        priority: 66,
        active: true
    },
    {
        hashtag: '#Avistaje',
        normalizedHashtag: '#avistaje',
        category: 'nature',
        priority: 67,
        active: true
    },
    // Experience
    // NOTE: '#Relax' → '#relax' is intentionally NOT re-added here — it
    // collides with the existing row above (priority 35) and would violate
    // the UNIQUE constraint on normalized_hashtag.
    {
        hashtag: '#Escapada',
        normalizedHashtag: '#escapada',
        category: 'experience',
        priority: 68,
        active: true
    },
    {
        hashtag: '#EscapadaRomantica',
        normalizedHashtag: '#escapadaromantica',
        category: 'experience',
        priority: 69,
        active: true
    },
    {
        hashtag: '#FindeLargo',
        normalizedHashtag: '#findelargo',
        category: 'experience',
        priority: 70,
        active: true
    },
    {
        hashtag: '#Descanso',
        normalizedHashtag: '#descanso',
        category: 'experience',
        priority: 71,
        active: true
    },
    // Family
    {
        hashtag: '#Familia',
        normalizedHashtag: '#familia',
        category: 'family',
        priority: 72,
        active: true
    },
    {
        hashtag: '#VacacionesEnFamilia',
        normalizedHashtag: '#vacacionesenfamilia',
        category: 'family',
        priority: 73,
        active: true
    },
    {
        hashtag: '#TurismoFamiliar',
        normalizedHashtag: '#turismofamiliar',
        category: 'family',
        priority: 74,
        active: true
    },
    // Season
    {
        hashtag: '#VacacionesDeInvierno',
        normalizedHashtag: '#vacacionesdeinvierno',
        category: 'season',
        priority: 75,
        active: true
    },
    {
        hashtag: '#Invierno',
        normalizedHashtag: '#invierno',
        category: 'season',
        priority: 76,
        active: true
    },
    {
        hashtag: '#Julio',
        normalizedHashtag: '#julio',
        category: 'season',
        priority: 77,
        active: true
    },
    // Holiday
    {
        hashtag: '#Navidad',
        normalizedHashtag: '#navidad',
        category: 'holiday',
        priority: 78,
        active: true
    },
    {
        hashtag: '#AnioNuevo',
        normalizedHashtag: '#anionuevo',
        category: 'holiday',
        priority: 79,
        active: true
    },
    {
        hashtag: '#FinDeAnio',
        normalizedHashtag: '#findeanio',
        category: 'holiday',
        priority: 80,
        active: true
    },
    {
        hashtag: '#Fiestas',
        normalizedHashtag: '#fiestas',
        category: 'holiday',
        priority: 81,
        active: true
    },
    {
        hashtag: '#DiaDeLaMadre',
        normalizedHashtag: '#diadelamadre',
        category: 'holiday',
        priority: 82,
        active: true
    },
    // Events
    {
        hashtag: '#FiestaDeLaArtesania',
        normalizedHashtag: '#fiestadelaartesania',
        category: 'events',
        priority: 83,
        active: true
    },
    {
        hashtag: '#FiestaNacionalDeLaArtesania',
        normalizedHashtag: '#fiestanacionaldelaartesania',
        category: 'events',
        priority: 84,
        active: true
    },
    {
        hashtag: '#FiestaDeLaPlaya',
        normalizedHashtag: '#fiestadelaplaya',
        category: 'events',
        priority: 85,
        active: true
    },
    {
        hashtag: '#FiestaNacionalDelLago',
        normalizedHashtag: '#fiestanacionaldellago',
        category: 'events',
        priority: 86,
        active: true
    },
    {
        hashtag: '#FiestaDeLaCitricultura',
        normalizedHashtag: '#fiestadelacitricultura',
        category: 'events',
        priority: 87,
        active: true
    },
    {
        hashtag: '#Citricultura',
        normalizedHashtag: '#citricultura',
        category: 'events',
        priority: 88,
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
 * Seeds the 5 social platform config rows.
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
 * Seeds the platform-format config rows (15 unique combos).
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
 * Seeds the social campaigns catalog.
 * Idempotent: skips rows where `slug` already exists.
 */
async function seedSocialCampaigns(): Promise<void> {
    const model = new SocialCampaignModel();
    let created = 0;
    let skipped = 0;

    for (const row of CAMPAIGNS) {
        const existing = await model.findOne({ slug: row.slug });
        if (existing) {
            logSkip('SocialCampaign', row.slug);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialCampaign "${row.slug}" created`);
        created++;
        summaryTracker.trackSuccess('SocialCampaign');
    }

    logger.success({
        msg: `SocialCampaigns seeded: ${created} created, ${skipped} already existed`
    });
}

/**
 * Seeds the social content batches catalog.
 * Idempotent: skips rows where `slug` already exists.
 */
async function seedSocialContentBatches(): Promise<void> {
    const model = new SocialContentBatchModel();
    let created = 0;
    let skipped = 0;

    for (const row of CONTENT_BATCHES) {
        const existing = await model.findOne({ slug: row.slug });
        if (existing) {
            logSkip('SocialContentBatch', row.slug);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialContentBatch "${row.slug}" created`);
        created++;
        summaryTracker.trackSuccess('SocialContentBatch');
    }

    logger.success({
        msg: `SocialContentBatches seeded: ${created} created, ${skipped} already existed`
    });
}

/**
 * Seeds the social post footers catalog.
 * Idempotent: skips rows where `slug` already exists.
 */
async function seedSocialFooters(): Promise<void> {
    const model = new SocialPostFooterModel();
    let created = 0;
    let skipped = 0;

    for (const row of FOOTERS) {
        const existing = await model.findOne({ slug: row.slug });
        if (existing) {
            logSkip('SocialPostFooter', row.slug);
            skipped++;
            continue;
        }
        await model.create(row);
        logger.info(`  SocialPostFooter "${row.slug}" created`);
        created++;
        summaryTracker.trackSuccess('SocialPostFooter');
    }

    logger.success({
        msg: `SocialPostFooters seeded: ${created} created, ${skipped} already existed`
    });
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
        },
        {
            name: 'Grupos de Amigos',
            slug: 'grupos-de-amigos',
            description: 'Escapadas grupales, cabañas grandes y actividades',
            active: true
        },
        {
            name: 'Viajeros Solos',
            slug: 'viajeros-solos',
            description: 'Turismo individual, mochileros y experiencias',
            active: true
        },
        {
            name: 'Adultos Mayores',
            slug: 'adultos-mayores',
            description: 'Turismo termal, descanso y ritmo tranquilo',
            active: true
        },
        {
            name: 'Viajan con Mascotas',
            slug: 'con-mascotas',
            description: 'Público que busca alojamientos pet friendly',
            active: true
        },
        {
            name: 'Turismo Termal y Bienestar',
            slug: 'turismo-termal',
            description: 'Público de termas, spa y descanso',
            active: true
        },
        {
            name: 'Pescadores',
            slug: 'pescadores',
            description: 'Pesca deportiva en el Río Uruguay',
            active: true
        },
        {
            name: 'Contingentes y Empresas',
            slug: 'contingentes-empresas',
            description: 'Grupos corporativos, contingentes y eventos',
            active: true
        },
        {
            name: 'Viajes de Egresados',
            slug: 'egresados',
            description: 'Grupos de egresados y viajes estudiantiles',
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
 *   platforms → platform-formats → settings → campaigns → content batches
 *   → audiences → footers → hashtag-sets → hashtags
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

        // 4. Campaigns (no deps)
        await seedSocialCampaigns();

        // 5. Content batches (no deps)
        await seedSocialContentBatches();

        // 6. Audiences (no deps; hashtags may reference them but we seed audiences first)
        await seedSocialAudiences();

        // 7. Footers (no deps)
        await seedSocialFooters();

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
