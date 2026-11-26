import { accommodationMedia, accommodations, getDb } from '@repo/db';
import type { Locale } from '@repo/i18n';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { ServiceContext } from '../../../types/index.js';
import { DynamicResolutionError } from './dynamic-resolution.error.js';
import type { DynamicCard, LocalizedCard } from './dynamic-source.port.js';

/** Card query dependencies, supplied by the application composition root. */
export interface CardLoaderInput {
    readonly ids: readonly string[];
    readonly locales: readonly Locale[];
    readonly siteUrl: string;
    readonly ctx?: ServiceContext;
}

/** Registered card loader for an enabled entity type. */
export type CardLoader = (input: CardLoaderInput) => Promise<ReadonlyMap<string, LocalizedCard>>;

/** Load plain localized content and an HTTPS-only featured cover in two batched reads. */
export async function loadAccommodationCards(
    input: CardLoaderInput
): Promise<ReadonlyMap<string, LocalizedCard>> {
    if (!input.ids.length) return new Map();
    let origin: URL;
    try {
        origin = new URL(input.siteUrl);
    } catch {
        throw new DynamicResolutionError({ code: 'INVALID_SITE_URL' });
    }
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) {
        throw new DynamicResolutionError({ code: 'INVALID_SITE_URL' });
    }
    const db = input.ctx?.tx ?? getDb();
    const rows = await db
        .select({
            id: accommodations.id,
            slug: accommodations.slug,
            name: accommodations.name,
            summary: accommodations.summary,
            nameI18n: accommodations.nameI18n,
            summaryI18n: accommodations.summaryI18n
        })
        .from(accommodations)
        .where(inArray(accommodations.id, [...input.ids]));
    const media = await db
        .select({ id: accommodationMedia.accommodationId, url: accommodationMedia.url })
        .from(accommodationMedia)
        .where(
            and(
                inArray(accommodationMedia.accommodationId, [...input.ids]),
                eq(accommodationMedia.isFeatured, true),
                isNull(accommodationMedia.deletedAt)
            )
        )
        .orderBy(asc(accommodationMedia.id));
    const covers = new Map<string, string | null>();
    for (const row of media) {
        if (covers.has(row.id)) continue;
        let imageUrl: string | null = null;
        try {
            const url = new URL(row.url);
            if (url.protocol === 'https:') imageUrl = url.href;
        } catch {
            /* Invalid media URLs are omitted rather than rendered. */
        }
        covers.set(row.id, imageUrl);
    }
    const cards = new Map<string, LocalizedCard>();
    for (const row of rows) {
        const localized: Partial<Record<Locale, DynamicCard>> = {};
        for (const locale of input.locales) {
            localized[locale] = {
                name: row.nameI18n?.[locale]?.trim() || row.name,
                summary: row.summaryI18n?.[locale]?.trim() || row.summary,
                imageUrl: covers.get(row.id) ?? null,
                url: new URL(`/${locale}/alojamientos/${encodeURIComponent(row.slug)}/`, origin)
                    .href
            };
        }
        cards.set(row.id, localized);
    }
    return cards;
}
