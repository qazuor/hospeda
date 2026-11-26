import { InMemoryImageProvider } from '@repo/media/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ubajay from '../../src/data/destination/010-destination-ubajay.json';
import fixture from '../../src/data/destination/102-destination-entre-rios.json';
import {
    entreRiosCover,
    meta as migrationMeta,
    up
} from '../../src/data-migrations/0194-hos-2648-entre-rios-cover.js';
import { baselineStamp } from '../../src/data-migrations/baselineStamp.js';
import { recordApplied } from '../../src/data-migrations/ledger.js';
import { resolvePendingMigrations } from '../../src/data-migrations/runner.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { processEntityImages } from '../../src/utils/cloudinary-image-processor.js';
import { isAllowedSeedUrl } from '../../src/utils/is-allowed-seed-url.js';

vi.mock('../../src/data-migrations/runner.js', () => ({ resolvePendingMigrations: vi.fn() }));
vi.mock('../../src/data-migrations/ledger.js', () => ({
    computeChecksum: vi.fn().mockReturnValue('test-checksum'),
    recordApplied: vi.fn()
}));
const legacyCopy = {
    name: 'Entre Rios',
    summary:
        'Provincia mesopotamica entre los rios Parana y Uruguay, tierra de termas y carnavales',
    description:
        "Entre Rios es una provincia argentina ubicada en la region mesopotamica, delimitada por los rios Parana y Uruguay. Conocida como la 'Tierra de los Carnavales' y cuna del turismo termal argentino, ofrece una combinacion unica de playas fluviales, complejos termales, historia y tradicion. Sus ciudades costeras como Colon, Gualeguaychu y Concepcion del Uruguay son destinos turisticos consolidados que atraen visitantes durante todo el anio.",
    location: { ...fixture.location, state: 'Entre Rios' },
    seo: {
        title: 'Entre Rios - Turismo y Alojamiento',
        description: 'Descubre Entre Rios: termas, carnavales, playas fluviales y naturaleza.',
        keywords: ['Entre Rios', 'termas', 'carnavales', 'turismo', 'alojamiento']
    }
};

const cloudinaryLegacy =
    'https://res.cloudinary.com/demo/image/upload/v987/hospeda/prod/seed/destinations/102-destination-entre-rios/featured.webp';
const editorCover = {
    url: 'https://res.cloudinary.com/demo/image/upload/v987/hospeda/prod/destinations/102-destination-entre-rios/featured.webp'
};

function migrationDb({ row }: { readonly row: Record<string, unknown> }) {
    const current = { id: 'province-id', ...row };
    const where = vi.fn();
    const set = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
        Object.assign(current, patch);
        return { where };
    });
    const db = {
        execute: vi.fn(),
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([current]) })
            })
        }),
        update: vi.fn().mockReturnValue({ set })
    };
    return { ctx: { db } as unknown as SeedMigrationCtx, current, set };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('Entre Ríos cover dual-write', () => {
    it('uses the allowlisted, owned Ubajay cover in both the fixture and migration', () => {
        const { url, attribution, moderationState } = ubajay.media.featuredImage;
        expect(isAllowedSeedUrl(fixture.media.featuredImage.url)).toBe(true);
        expect(fixture.media.featuredImage).toEqual({
            url,
            caption: 'Palmeras al atardecer en Ubajay',
            attribution,
            moderationState
        });
        expect(entreRiosCover).toEqual(fixture.media.featuredImage);
    });

    it('processes the replacement through the required-seed image pipeline', async () => {
        vi.stubEnv('HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS', 'false');
        const fetchImage = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
        vi.stubGlobal('fetch', fetchImage);
        const provider = new InMemoryImageProvider({ cloudName: 'demo' });

        const processed = await processEntityImages({
            data: fixture,
            entityType: 'destinations',
            entityId: fixture.id,
            provider,
            cache: {},
            cachePath: 'unused-test-cache',
            env: 'test',
            seedSource: 'required'
        });

        expect(fetchImage).toHaveBeenCalledExactlyOnceWith(fixture.media.featuredImage.url);
        expect(provider.has(`hospeda/test/seed/destinations/${fixture.id}/featured`)).toBe(true);
        expect(processed.media).toMatchObject({
            featuredImage: {
                ...fixture.media.featuredImage,
                url: expect.stringContaining('/demo/image/upload/')
            }
        });
    });

    it.each([
        cloudinaryLegacy,
        'https://res.cloudinary.com/another/image/upload/f_auto,q_auto/hospeda/check-42/seed/destinations/102-destination-entre-rios/featured',
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop'
    ])('replaces the legacy cover and keeps the gallery: %s', async (url) => {
        const gallery = [editorCover];
        const { ctx, current } = migrationDb({
            row: { ...legacyCopy, media: { featuredImage: { url }, gallery } }
        });

        await up(ctx);

        expect(current).toMatchObject({ media: { featuredImage: entreRiosCover, gallery } });
    });

    it.each([
        editorCover,
        { url: cloudinaryLegacy.replace('featured.webp', 'featured-editor.webp') },
        { url: cloudinaryLegacy, caption: 'Editor-managed cover' },
        { ...fixture.media.featuredImage, url: cloudinaryLegacy }
    ])('keeps editor-owned and freshly seeded covers: %j', async (featuredImage) => {
        const { ctx, set } = migrationDb({ row: { ...fixture, media: { featuredImage } } });

        await up(ctx);

        expect(set).not.toHaveBeenCalled();
    });

    it('corrects legacy Spanish copy to match the accented fixture', async () => {
        const { ctx, current } = migrationDb({
            row: { ...legacyCopy, media: { featuredImage: editorCover } }
        });

        await up(ctx);

        expect(fixture).toMatchObject({
            name: 'Entre Ríos',
            summary: expect.stringContaining('mesopotámica entre los ríos Paraná'),
            description: expect.stringMatching(
                /región mesopotámica.*combinación única.*Colón, Gualeguaychú y Concepción.*todo el año/
            ),
            location: { state: 'Entre Ríos' },
            seo: {
                title: 'Entre Ríos - Turismo y Alojamiento',
                description: expect.stringContaining('Entre Ríos'),
                keywords: expect.arrayContaining(['Entre Ríos'])
            }
        });
        const { name, summary, description, location, seo } = fixture;
        expect(current).toMatchObject({ name, summary, description, location, seo });
    });

    it('corrects unedited fields without discarding edited text, SEO or location fields', async () => {
        const { ctx, current } = migrationDb({
            row: {
                ...legacyCopy,
                summary: 'Editor summary',
                location: { ...legacyCopy.location, country: 'Edited country' },
                seo: { ...legacyCopy.seo, title: 'Editor title', keywords: ['Editor keyword'] },
                media: null
            }
        });

        await up(ctx);

        expect(current).toMatchObject({
            name: 'Entre Ríos',
            summary: 'Editor summary',
            location: { state: 'Entre Ríos', country: 'Edited country' },
            seo: { ...fixture.seo, title: 'Editor title', keywords: ['Editor keyword'] },
            media: null
        });
    });

    it('stamps the fixture-backed migration instead of deferring it for execution', async () => {
        const db = {} as SeedMigrationCtx['db'];
        vi.mocked(resolvePendingMigrations).mockResolvedValue({
            db,
            pending: [
                {
                    ...migrationMeta,
                    meta: migrationMeta,
                    filePath: new URL(
                        `../../src/data-migrations/${migrationMeta.name}.ts`,
                        import.meta.url
                    ).pathname,
                    module: { meta: migrationMeta, up }
                }
            ]
        } as Awaited<ReturnType<typeof resolvePendingMigrations>>);

        const result = await baselineStamp({ db });

        expect(result).toEqual({ stamped: [migrationMeta.name], deferred: [] });
        expect(recordApplied).toHaveBeenCalledWith(
            expect.objectContaining({ name: migrationMeta.name, result: 'baseline-stamp' })
        );
    });
});
