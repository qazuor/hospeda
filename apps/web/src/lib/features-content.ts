/**
 * @file features-content.ts
 * @description Structured data driving the `/[lang]/funcionalidades/` marketing
 * page (HOS-119). Holds the section layout, icon mapping, and i18n key
 * references for every audience section, plan table, addon, "y además" chip,
 * and "próximamente" card in the brochure. Contains NO copy literals — every
 * label references a key under the `features.*` i18n namespace
 * (`packages/i18n/src/locales/{es,en,pt}/features.json`) — and NO prices.
 *
 * The page component (`pages/[lang]/funcionalidades/index.astro`) imports these
 * arrays and resolves each key through `t()` at render time, keeping the
 * `.astro` file focused on markup instead of data.
 */

import type { IconProps } from '@repo/icons';
import {
    AskToAiIcon,
    BriefcaseIcon,
    BuildingsIcon,
    CalendarIcon,
    ChatIcon,
    ClockIcon,
    CloudSunIcon,
    CreditCardIcon,
    GalleryIcon,
    GlobeIcon,
    HomeIcon,
    ListIcon,
    MailIcon,
    SearchIcon,
    ShieldIcon,
    SparkleIcon,
    TagIcon,
    UserIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

/** Shape of every icon exported by `@repo/icons` — a React component accepting `IconProps`. */
export type IconComponent = ComponentType<IconProps>;

/** Brand color variant used to tint an icon chip / badge / accent. Maps to the page's local `--fx-*` custom properties. */
export type FeatureColorVariant = 'river' | 'sun' | 'forest' | 'sky';

/**
 * One of the four "un vistazo" pillar cards.
 */
export interface PillarItem {
    readonly Icon: IconComponent;
    readonly variant: FeatureColorVariant;
    readonly titleKey: string;
    readonly descriptionKey: string;
}

/** The four pillar cards under "Un vistazo" (Descubrir, Hospedarse, Publicar y crecer, Sumar tu negocio). */
export const PILLARS: readonly PillarItem[] = [
    {
        Icon: SearchIcon,
        variant: 'river',
        titleKey: 'features.vistazo.pillars.descubrir.title',
        descriptionKey: 'features.vistazo.pillars.descubrir.description'
    },
    {
        Icon: HomeIcon,
        variant: 'forest',
        titleKey: 'features.vistazo.pillars.hospedarse.title',
        descriptionKey: 'features.vistazo.pillars.hospedarse.description'
    },
    {
        Icon: BuildingsIcon,
        variant: 'sun',
        titleKey: 'features.vistazo.pillars.publicar.title',
        descriptionKey: 'features.vistazo.pillars.publicar.description'
    },
    {
        Icon: BriefcaseIcon,
        variant: 'river',
        titleKey: 'features.vistazo.pillars.sumarNegocio.title',
        descriptionKey: 'features.vistazo.pillars.sumarNegocio.description'
    }
] as const;

/**
 * A single audience subnav entry. `id` matches the `id` attribute of the
 * corresponding section, used both for the anchor `href` and for the
 * `FeaturesSubnav` scroll-spy island.
 */
export interface SubnavLink {
    readonly id: string;
    readonly labelKey: string;
}

/** Ordered audience subnav entries (rendered as static anchors; scroll-spy handled by `FeaturesSubnav`). */
export const SUBNAV_LINKS: readonly SubnavLink[] = [
    { id: 'viajeros', labelKey: 'features.subnav.viajeros' },
    { id: 'anfitriones', labelKey: 'features.subnav.anfitriones' },
    { id: 'gastro', labelKey: 'features.subnav.gastro' },
    { id: 'marcas', labelKey: 'features.subnav.marcas' },
    { id: 'ademas', labelKey: 'features.subnav.ademas' },
    { id: 'proximamente', labelKey: 'features.subnav.proximamente' }
] as const;

/** A single hero stat pill (e.g. "+120 funcionalidades"). */
export interface HeroStat {
    readonly variant: FeatureColorVariant | 'neutral';
    readonly valueKey: string;
    readonly labelKey: string;
}

/** The four stat pills under the hero lede. */
export const HERO_STATS: readonly HeroStat[] = [
    {
        variant: 'river',
        valueKey: 'features.hero.stats.features.value',
        labelKey: 'features.hero.stats.features.label'
    },
    {
        variant: 'forest',
        valueKey: 'features.hero.stats.languages.value',
        labelKey: 'features.hero.stats.languages.label'
    },
    {
        variant: 'sun',
        valueKey: 'features.hero.stats.trial.value',
        labelKey: 'features.hero.stats.trial.label'
    },
    {
        variant: 'neutral',
        valueKey: 'features.hero.stats.worlds.value',
        labelKey: 'features.hero.stats.worlds.label'
    }
] as const;

/** A single checkmark benefit row (used by the Viajeros / Anfitriones / Gastro "flist" grids). */
export interface FeatureListItem {
    readonly titleKey: string;
    readonly descriptionKey: string;
}

/** Viajeros section: 9 benefit rows always included with a free account. */
export const VIAJEROS_LIST: readonly FeatureListItem[] = [
    {
        titleKey: 'features.viajeros.list.search.title',
        descriptionKey: 'features.viajeros.list.search.description'
    },
    {
        titleKey: 'features.viajeros.list.aiSearch.title',
        descriptionKey: 'features.viajeros.list.aiSearch.description'
    },
    {
        titleKey: 'features.viajeros.list.weather.title',
        descriptionKey: 'features.viajeros.list.weather.description'
    },
    {
        titleKey: 'features.viajeros.list.contactHost.title',
        descriptionKey: 'features.viajeros.list.contactHost.description'
    },
    {
        titleKey: 'features.viajeros.list.reviews.title',
        descriptionKey: 'features.viajeros.list.reviews.description'
    },
    {
        titleKey: 'features.viajeros.list.eventsAgenda.title',
        descriptionKey: 'features.viajeros.list.eventsAgenda.description'
    },
    {
        titleKey: 'features.viajeros.list.sorting.title',
        descriptionKey: 'features.viajeros.list.sorting.description'
    },
    {
        titleKey: 'features.viajeros.list.similar.title',
        descriptionKey: 'features.viajeros.list.similar.description'
    },
    {
        titleKey: 'features.viajeros.list.socialProof.title',
        descriptionKey: 'features.viajeros.list.socialProof.description'
    }
] as const;

/** Anfitriones section: 9 benefit rows always included, regardless of plan. */
export const ANFITRIONES_LIST: readonly FeatureListItem[] = [
    {
        titleKey: 'features.anfitriones.list.aiImport.title',
        descriptionKey: 'features.anfitriones.list.aiImport.description'
    },
    {
        titleKey: 'features.anfitriones.list.aiWrite.title',
        descriptionKey: 'features.anfitriones.list.aiWrite.description'
    },
    {
        titleKey: 'features.anfitriones.list.promotions.title',
        descriptionKey: 'features.anfitriones.list.promotions.description'
    },
    {
        titleKey: 'features.anfitriones.list.stats.title',
        descriptionKey: 'features.anfitriones.list.stats.description'
    },
    {
        titleKey: 'features.anfitriones.list.reputation.title',
        descriptionKey: 'features.anfitriones.list.reputation.description'
    },
    {
        titleKey: 'features.anfitriones.list.calendarSync.title',
        descriptionKey: 'features.anfitriones.list.calendarSync.description'
    },
    {
        titleKey: 'features.anfitriones.list.vipTraveler.title',
        descriptionKey: 'features.anfitriones.list.vipTraveler.description'
    },
    {
        titleKey: 'features.anfitriones.list.guestChat.title',
        descriptionKey: 'features.anfitriones.list.guestChat.description'
    },
    {
        titleKey: 'features.anfitriones.list.seo.title',
        descriptionKey: 'features.anfitriones.list.seo.description'
    },
    {
        titleKey: 'features.anfitriones.list.hostTrades.title',
        descriptionKey: 'features.anfitriones.list.hostTrades.description'
    }
] as const;

/** Gastronomía y experiencias section: 4 benefit rows. */
export const GASTRO_LIST: readonly FeatureListItem[] = [
    {
        titleKey: 'features.gastro.list.ownProfile.title',
        descriptionKey: 'features.gastro.list.ownProfile.description'
    },
    {
        titleKey: 'features.gastro.list.reviewsFaqs.title',
        descriptionKey: 'features.gastro.list.reviewsFaqs.description'
    },
    {
        titleKey: 'features.gastro.list.selfEdit.title',
        descriptionKey: 'features.gastro.list.selfEdit.description'
    },
    {
        titleKey: 'features.gastro.list.seo.title',
        descriptionKey: 'features.gastro.list.seo.description'
    }
] as const;

/**
 * A single plan-table cell value. `yes`/`no` render as check/dash icons,
 * `limit`/`unlimited` render numeric-limit chips, `addon` renders the
 * "con addon" pill, `upcoming` renders the "Próximamente" pill (feature
 * announced for a plan but not yet shipped — keeps the brochure honest), and
 * `text` renders an arbitrary short i18n-sourced label (e.g. "ver" / "directo"
 * for the WhatsApp row).
 */
export type PlanCellValue =
    | { readonly kind: 'yes' }
    | { readonly kind: 'no' }
    | { readonly kind: 'limit'; readonly value: string }
    | { readonly kind: 'unlimited' }
    | { readonly kind: 'addon' }
    | { readonly kind: 'upcoming' }
    | { readonly kind: 'text'; readonly labelKey: string };

/** One row of a plan comparison table: a feature label plus one cell per plan column. */
export interface PlanTableRow {
    readonly labelKey: string;
    readonly noteKey?: string;
    readonly cells: readonly [PlanCellValue, PlanCellValue, PlanCellValue];
}

/** Viajeros plan table: Gratis / Plus (popular) / VIP — 11 rows, no prices. */
export const VIAJEROS_TABLE_ROWS: readonly PlanTableRow[] = [
    {
        labelKey: 'features.viajeros.table.rows.favorites.label',
        cells: [
            { kind: 'limit', value: '5' },
            { kind: 'limit', value: '25' },
            { kind: 'unlimited' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.collections.label',
        noteKey: 'features.viajeros.table.rows.collections.note',
        cells: [{ kind: 'no' }, { kind: 'limit', value: '10' }, { kind: 'limit', value: '25' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.compare.label',
        noteKey: 'features.viajeros.table.rows.compare.note',
        cells: [{ kind: 'no' }, { kind: 'limit', value: '3' }, { kind: 'limit', value: '5' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.priceAlerts.label',
        noteKey: 'features.viajeros.table.rows.priceAlerts.note',
        cells: [{ kind: 'no' }, { kind: 'limit', value: '5' }, { kind: 'unlimited' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.recommendations.label',
        cells: [{ kind: 'no' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.reviews.label',
        cells: [{ kind: 'yes' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.exclusiveOffers.label',
        cells: [{ kind: 'no' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.viajeros.table.rows.hostWhatsapp.label',
        cells: [
            { kind: 'no' },
            { kind: 'text', labelKey: 'features.viajeros.table.rows.hostWhatsapp.plusValue' },
            { kind: 'text', labelKey: 'features.viajeros.table.rows.hostWhatsapp.vipValue' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.aiSearch.label',
        noteKey: 'features.viajeros.table.rows.aiSearch.note',
        cells: [
            { kind: 'limit', value: '10' },
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '200' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.aiChat.label',
        noteKey: 'features.viajeros.table.rows.aiChat.note',
        cells: [
            { kind: 'limit', value: '10' },
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '200' }
        ]
    },
    {
        labelKey: 'features.viajeros.table.rows.prioritySupport.label',
        cells: [{ kind: 'no' }, { kind: 'no' }, { kind: 'yes' }]
    }
] as const;

/** Anfitriones plan table: Básico / Pro (popular) / Premium — 13 rows, no prices. */
export const ANFITRIONES_TABLE_ROWS: readonly PlanTableRow[] = [
    {
        labelKey: 'features.anfitriones.table.rows.listings.label',
        noteKey: 'features.anfitriones.table.rows.listings.note',
        cells: [
            { kind: 'limit', value: '1' },
            { kind: 'limit', value: '3' },
            { kind: 'limit', value: '10' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.photos.label',
        noteKey: 'features.anfitriones.table.rows.photos.note',
        cells: [
            { kind: 'limit', value: '15' },
            { kind: 'limit', value: '30' },
            { kind: 'limit', value: '50' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.activePromotions.label',
        cells: [{ kind: 'limit', value: '2' }, { kind: 'limit', value: '5' }, { kind: 'unlimited' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.richDescription.label',
        cells: [{ kind: 'no' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.advancedStats.label',
        cells: [{ kind: 'no' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.featuredListing.label',
        cells: [{ kind: 'addon' }, { kind: 'yes' }, { kind: 'yes' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.verificationBadge.label',
        cells: [{ kind: 'no' }, { kind: 'no' }, { kind: 'yes' }]
    },
    {
        // CUSTOM_BRANDING is announced for Premium but not yet shipped (no gate,
        // no surface). Show it honestly as "Próximamente" instead of a plain ✓
        // so /funcionalidades matches PlanComparisonTable's `upcoming` status.
        labelKey: 'features.anfitriones.table.rows.customBranding.label',
        cells: [{ kind: 'no' }, { kind: 'no' }, { kind: 'upcoming' }]
    },
    {
        // PRIORITY_SUPPORT is a marketing-only entitlement (no implementation).
        // Mark the Pro/Premium cells as upcoming rather than a false ✓.
        labelKey: 'features.anfitriones.table.rows.prioritySupport.label',
        cells: [{ kind: 'no' }, { kind: 'upcoming' }, { kind: 'upcoming' }]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiImport.label',
        noteKey: 'features.anfitriones.table.rows.aiImport.note',
        cells: [
            { kind: 'limit', value: '10' },
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '250' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiImprove.label',
        noteKey: 'features.anfitriones.table.rows.aiImprove.note',
        cells: [
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '250' },
            { kind: 'limit', value: '1.250' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiTranslate.label',
        noteKey: 'features.anfitriones.table.rows.aiTranslate.note',
        cells: [
            { kind: 'limit', value: '200' },
            { kind: 'limit', value: '1.000' },
            { kind: 'limit', value: '5.000' }
        ]
    },
    {
        labelKey: 'features.anfitriones.table.rows.aiGuestChat.label',
        noteKey: 'features.anfitriones.table.rows.aiGuestChat.note',
        cells: [
            { kind: 'limit', value: '50' },
            { kind: 'limit', value: '250' },
            { kind: 'limit', value: '1.250' }
        ]
    }
] as const;

/** A single addon card (Anfitriones "¿Necesitás un poco más?" grid). No prices. */
export interface AddonCard {
    readonly titleKey: string;
    readonly descriptionKey: string;
}

/** The three anfitriones addons: Visibility Boost, extra photos, extra listings. */
export const ANFITRIONES_ADDONS: readonly AddonCard[] = [
    {
        titleKey: 'features.anfitriones.addons.visibilityBoost.title',
        descriptionKey: 'features.anfitriones.addons.visibilityBoost.description'
    },
    {
        titleKey: 'features.anfitriones.addons.extraPhotos.title',
        descriptionKey: 'features.anfitriones.addons.extraPhotos.description'
    },
    {
        titleKey: 'features.anfitriones.addons.extraListings.title',
        descriptionKey: 'features.anfitriones.addons.extraListings.description'
    }
] as const;

/** A single "Marcas" card (Partners auspiciantes / Patrocinio de contenido). */
export interface BrandCard {
    readonly Icon: IconComponent;
    readonly variant: FeatureColorVariant;
    readonly titleKey: string;
    readonly descriptionKey: string;
}

/** The two ways brands/sponsors can be present on the platform. */
export const MARCAS_CARDS: readonly BrandCard[] = [
    {
        Icon: ShieldIcon,
        variant: 'river',
        titleKey: 'features.marcas.cards.partners.title',
        descriptionKey: 'features.marcas.cards.partners.description'
    },
    {
        Icon: SparkleIcon,
        variant: 'sun',
        titleKey: 'features.marcas.cards.sponsorship.title',
        descriptionKey: 'features.marcas.cards.sponsorship.description'
    }
] as const;

/** A single "Y además" chip: a platform-wide detail not tied to any plan. */
export interface ExtraItem {
    readonly Icon: IconComponent;
    readonly titleKey: string;
    readonly descriptionKey: string;
}

/** The six "y además, siempre" platform-wide details. */
export const EXTRAS: readonly ExtraItem[] = [
    {
        Icon: GlobeIcon,
        titleKey: 'features.ademas.items.languages.title',
        descriptionKey: 'features.ademas.items.languages.description'
    },
    {
        Icon: CloudSunIcon,
        titleKey: 'features.ademas.items.weather.title',
        descriptionKey: 'features.ademas.items.weather.description'
    },
    {
        Icon: CalendarIcon,
        titleKey: 'features.ademas.items.events.title',
        descriptionKey: 'features.ademas.items.events.description'
    },
    {
        Icon: ListIcon,
        titleKey: 'features.ademas.items.blog.title',
        descriptionKey: 'features.ademas.items.blog.description'
    },
    {
        Icon: MailIcon,
        titleKey: 'features.ademas.items.newsletter.title',
        descriptionKey: 'features.ademas.items.newsletter.description'
    },
    {
        Icon: TagIcon,
        titleKey: 'features.ademas.items.promoCodes.title',
        descriptionKey: 'features.ademas.items.promoCodes.description'
    }
] as const;

/** A single "Próximamente" card: an honest, not-yet-available feature with its own future spec. */
export interface SoonItem {
    readonly id: string;
    readonly Icon: IconComponent;
    readonly titleKey: string;
    readonly descriptionKey: string;
}

/** The eight "próximamente" cards, in brochure order. */
export const SOON_ITEMS: readonly SoonItem[] = [
    {
        id: 'tourist-card',
        Icon: CreditCardIcon,
        titleKey: 'features.proximamente.items.touristCard.title',
        descriptionKey: 'features.proximamente.items.touristCard.description'
    },
    {
        id: 'multi-property',
        Icon: BuildingsIcon,
        titleKey: 'features.proximamente.items.multiProperty.title',
        descriptionKey: 'features.proximamente.items.multiProperty.description'
    },
    {
        id: 'host-profile',
        Icon: UserIcon,
        titleKey: 'features.proximamente.items.hostProfile.title',
        descriptionKey: 'features.proximamente.items.hostProfile.description'
    },
    {
        id: 'review-replies',
        Icon: ChatIcon,
        titleKey: 'features.proximamente.items.reviewReplies.title',
        descriptionKey: 'features.proximamente.items.reviewReplies.description'
    },
    {
        id: 'review-photos',
        Icon: GalleryIcon,
        titleKey: 'features.proximamente.items.reviewPhotos.title',
        descriptionKey: 'features.proximamente.items.reviewPhotos.description'
    },
    {
        id: 'ai-support',
        Icon: AskToAiIcon,
        titleKey: 'features.proximamente.items.aiSupport.title',
        descriptionKey: 'features.proximamente.items.aiSupport.description'
    }
] as const;

/** Icon used by the Anfitriones "14 días gratis" highlight banner. */
export const ANFITRIONES_BANNER_ICON: IconComponent = ClockIcon;

/** "Who" badge icons per audience section (Viajeros / Anfitriones / Gastro / Marcas). */
export const AUDIENCE_ICONS = {
    viajeros: UserIcon,
    anfitriones: HomeIcon,
    gastro: BriefcaseIcon,
    marcas: ShieldIcon
} as const satisfies Record<string, IconComponent>;
