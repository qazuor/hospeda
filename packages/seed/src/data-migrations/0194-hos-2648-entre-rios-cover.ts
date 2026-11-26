/**
 * @fileoverview
 * Data migration: 0194-hos-2648-entre-rios-cover
 *
 * Replace the seeded scuba photo with the palm landscape cover from Ubajay and
 * correct the province’s Spanish copy without overwriting editorial changes.
 */
import { and, eq, isNull } from '@repo/db';
import { destinations } from '@repo/db/schemas';
import { extractPublicId } from '@repo/media';
import { ModerationStatusEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Discovery metadata for the fixture-backed Entre Ríos update. */
export const meta = {
    name: '0194-hos-2648-entre-rios-cover',
    group: 'required',
    destructive: false,
    requiresColumns: ['media', 'name', 'summary', 'description', 'location', 'seo'].map(
        (column) => ({
            table: 'destinations',
            column
        })
    )
} as const satisfies SeedMigrationModule['meta'];

/** Immutable snapshot of the replacement; the shared source asset is owned by Ubajay. */
export const entreRiosCover = {
    url: 'https://res.cloudinary.com/djqdu6u93/image/upload/v1779178231/hospeda/seed/required/destinations/010-destination-ubajay/featured.webp',
    caption: 'Palmeras al atardecer en Ubajay',
    attribution: {
        photographer: 'qazuor',
        license: 'Owned'
    },
    moderationState: ModerationStatusEnum.APPROVED
} as const;

const legacyCopy = {
    name: 'Entre Rios',
    summary:
        'Provincia mesopotamica entre los rios Parana y Uruguay, tierra de termas y carnavales',
    description:
        "Entre Rios es una provincia argentina ubicada en la region mesopotamica, delimitada por los rios Parana y Uruguay. Conocida como la 'Tierra de los Carnavales' y cuna del turismo termal argentino, ofrece una combinacion unica de playas fluviales, complejos termales, historia y tradicion. Sus ciudades costeras como Colon, Gualeguaychu y Concepcion del Uruguay son destinos turisticos consolidados que atraen visitantes durante todo el anio.",
    seoTitle: 'Entre Rios - Turismo y Alojamiento',
    seoDescription: 'Descubre Entre Rios: termas, carnavales, playas fluviales y naturaleza.',
    seoKeywords: ['Entre Rios', 'termas', 'carnavales', 'turismo', 'alojamiento']
};

const correctedCopy = {
    name: 'Entre Ríos',
    summary:
        'Provincia mesopotámica entre los ríos Paraná y Uruguay, tierra de termas y carnavales',
    description:
        "Entre Ríos es una provincia argentina ubicada en la región mesopotámica, delimitada por los ríos Paraná y Uruguay. Conocida como la 'Tierra de los Carnavales' y cuna del turismo termal argentino, ofrece una combinación única de playas fluviales, complejos termales, historia y tradición. Sus ciudades costeras como Colón, Gualeguaychú y Concepción del Uruguay son destinos turísticos consolidados que atraen visitantes durante todo el año.",
    seoTitle: 'Entre Ríos - Turismo y Alojamiento',
    seoDescription: 'Descubre Entre Ríos: termas, carnavales, playas fluviales y naturaleza.',
    seoKeywords: ['Entre Ríos', 'termas', 'carnavales', 'turismo', 'alojamiento']
};

type DestinationRow = typeof destinations.$inferSelect;

function isLegacyCover({
    image
}: {
    readonly image: NonNullable<DestinationRow['media']>['featuredImage'];
}): boolean {
    if (!image?.url) return false;
    if (
        /^https?:\/\/images\.unsplash\.com\/photo-1544551763-46a013bb70d5(?:[?#]|$)/.test(image.url)
    ) {
        return true;
    }

    // A fresh seed reuses the deterministic public ID. Keep its replacement
    // caption or any editorial caption; older copies may have no caption.
    const publicId = extractPublicId(image.url);
    return (
        (!image.caption || image.caption === 'Entre Rios - Provincia mesopotamica') &&
        publicId !== null &&
        /^hospeda\/[^/]+\/seed\/destinations\/102-destination-entre-rios\/featured$/.test(publicId)
    );
}

function buildCopyPatch({
    row
}: {
    readonly row: Pick<DestinationRow, 'name' | 'summary' | 'description' | 'location' | 'seo'>;
}) {
    const patch: Partial<
        Pick<DestinationRow, 'name' | 'summary' | 'description' | 'location' | 'seo'>
    > = {};
    for (const field of ['name', 'summary', 'description'] as const) {
        if (row[field] === legacyCopy[field]) patch[field] = correctedCopy[field];
    }
    if (row.location.state === legacyCopy.name) {
        patch.location = { ...row.location, state: correctedCopy.name };
    }
    const { seo } = row;
    if (seo) {
        // Current schema has no keywords field, but legacy JSONB may still carry it.
        const nextSeo: Partial<typeof seo> & { keywords?: string[] } = {};
        if (seo.title === legacyCopy.seoTitle) nextSeo.title = correctedCopy.seoTitle;
        if (seo.description === legacyCopy.seoDescription)
            nextSeo.description = correctedCopy.seoDescription;
        if (
            'keywords' in seo &&
            JSON.stringify(seo.keywords) === JSON.stringify(legacyCopy.seoKeywords)
        ) {
            nextSeo.keywords = correctedCopy.seoKeywords;
        }
        if (Object.keys(nextSeo).length > 0) patch.seo = { ...seo, ...nextSeo };
    }
    return patch;
}

/** Patch only known legacy fields, locking the destination within the runner’s transaction. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const [row] = await ctx.db
        .select({
            id: destinations.id,
            name: destinations.name,
            summary: destinations.summary,
            description: destinations.description,
            location: destinations.location,
            seo: destinations.seo,
            media: destinations.media
        })
        .from(destinations)
        .where(and(eq(destinations.slug, 'entre-rios'), isNull(destinations.deletedAt)))
        .for('update');

    if (!row) return { summary: 'No active Entre Ríos destination found' };

    const copyPatch = buildCopyPatch({ row });
    const mediaPatch =
        row.media && isLegacyCover({ image: row.media.featuredImage })
            ? { media: { ...row.media, featuredImage: entreRiosCover } }
            : {};
    const patch = { ...copyPatch, ...mediaPatch };
    if (Object.keys(patch).length === 0) return { summary: 'No legacy Entre Ríos content found' };

    await ctx.db
        .update(destinations)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(destinations.id, row.id));
    return { summary: 'Updated legacy Entre Ríos cover or Spanish copy where present' };
}
