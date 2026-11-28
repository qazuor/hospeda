import { accommodationMedia, accommodations, getDb } from '@repo/db';
import type { Locale } from '@repo/i18n';
import { getMediaUrl } from '@repo/media';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { ServiceContext } from '../../../types/index.js';
import { DynamicResolutionError } from './dynamic-resolution.error.js';
import type { DynamicCard, LocalizedCard } from './dynamic-source.port.js';

/** Newsletter card cover: 320x240 (the email renders it at 160x120), smart crop. */
const COVER_TRANSFORM = 'w_320,h_240,c_fill,g_auto,q_auto,f_auto';

/**
 * Turn a stored media URL into the card cover URL.
 *
 * Cloudinary covers get a 4:3 smart crop so every card cover has the same
 * shape; other HTTPS hosts pass through unchanged. Anything that is not an
 * HTTPS URL after the transform (invalid input, `http:`, or a local
 * placeholder) yields `null`, so the card renders without a cover.
 *
 * @param input.url - The stored media URL.
 * @returns The HTTPS cover URL, or `null` when none can be rendered.
 */
export function toCardCoverUrl({ url }: { readonly url: string }): string | null {
    try {
        if (new URL(url).protocol !== 'https:') return null;
        const cover = new URL(getMediaUrl(url, { raw: COVER_TRANSFORM }));
        return cover.protocol === 'https:' ? cover.href : null;
    } catch {
        return null;
    }
}

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
        covers.set(row.id, toCardCoverUrl({ url: row.url }));
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
