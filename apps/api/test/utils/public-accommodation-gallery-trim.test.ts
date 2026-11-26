/**
 * Public gallery trim of accommodations and the no-store signal of their
 * public readers (HOS-2495 T-022, AC-14, AC-22).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNLIMITED_LIMIT_VALUE } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

import { projectPublicAccommodations } from '../../src/utils/public-accommodation-projection';

const COVER = { url: 'https://cdn.example.com/cover.jpg' };
const photos = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ url: `https://cdn.example.com/${index}.jpg` }));
const accommodation = (galleryCount: number) => ({
    id: 'acc-1',
    ownerId: 'owner',
    media: { featuredImage: COVER, gallery: photos(galleryCount), videos: [] }
});

function setWith(photoCap: number | undefined) {
    mocks.effectiveSet.mockImplementation(async ({ userId, vertical }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: true,
            inheritsTouristVip: false,
            entries:
                photoCap === undefined
                    ? []
                    : [{ key: 'max_photos_per_accommodation', value: photoCap, strategy: 'SUM' }]
        })
    );
}

describe('accommodation public gallery trim', () => {
    beforeEach(() => {
        mocks.effectiveSet.mockReset();
    });

    it('shows the first 30 of 52 photos at cap 30 and keeps the cover', async () => {
        // Arrange
        setWith(30);

        // Act
        const [item] = await projectPublicAccommodations({ listings: [accommodation(52)] });

        // Assert
        expect(item?.media).toEqual({ featuredImage: COVER, gallery: photos(30), videos: [] });
    });

    it('shows every photo when the cap is unlimited', async () => {
        // Arrange
        setWith(UNLIMITED_LIMIT_VALUE);

        // Act
        const [item] = await projectPublicAccommodations({ listings: [accommodation(80)] });

        // Assert
        expect(item?.media.gallery).toHaveLength(80);
    });

    it('shows the cover alone when the owner holds no photo key', async () => {
        // Arrange
        setWith(undefined);

        // Act
        const [item] = await projectPublicAccommodations({ listings: [accommodation(5)] });

        // Assert
        expect(item?.media).toEqual({ featuredImage: COVER, gallery: [], videos: [] });
    });

    it('fails closed to the cover alone and signals the route once per failed owner', async () => {
        // Arrange
        mocks.effectiveSet.mockRejectedValue(new Error('redis down'));
        const onEffectiveSetFailure = vi.fn();

        // Act
        const [item] = await projectPublicAccommodations({
            listings: [accommodation(5)],
            onEffectiveSetFailure
        });

        // Assert
        expect(item?.media).toEqual({ featuredImage: COVER, gallery: [], videos: [] });
        expect(onEffectiveSetFailure).toHaveBeenCalledTimes(1);
    });
});

describe('every public accommodation reader answers no-store on a failed lookup', () => {
    const routesDir = fileURLToPath(new URL('../../src/routes', import.meta.url));
    const files = (dir: string): string[] =>
        readdirSync(dir).flatMap((entry) => {
            const path = join(dir, entry);
            return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
        });
    const callers = files(routesDir).filter((path) =>
        /projectPublicAccommodation(s|Page)\(/.test(readFileSync(path, 'utf8'))
    );

    it('finds the nine readers', () => {
        expect(callers).toHaveLength(9);
    });

    it.each(
        callers.map((path) => [path.slice(routesDir.length + 1), path])
    )('%s passes a no-store onEffectiveSetFailure to every projection call', (_name, path) => {
        const source = readFileSync(path, 'utf8');
        const calls = source.split(/projectPublicAccommodation(?:s|Page)\(\{/).slice(1);
        expect(calls.length).toBeGreaterThan(0);
        for (const call of calls) {
            const args = call.slice(0, call.indexOf('});'));
            expect(args).toMatch(
                /onEffectiveSetFailure: \(\) => \w+\.header\('Cache-Control', 'no-store'\)/
            );
        }
    });
});
