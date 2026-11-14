/**
 * Golden characterization of the public accommodation payload gating (HOS-1809).
 *
 * Captured BEFORE the accommodation editor and gating moved to the section
 * catalog. Every public accommodation reader goes through
 * `projectPublicAccommodations`, so this matrix pins what the public sees for
 * each combination of the owner's keys. The migration must leave
 * `expected.json` untouched: a diff there is a public-visible change.
 *
 * Regenerate deliberately by setting the `UPDATE_GOLDEN` variable to `1`.
 *
 * @module test/golden/accommodation-public-fields
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

import { projectPublicAccommodations } from '../../../src/utils/public-accommodation-projection';

const KEYS = ['can_use_rich_description', 'can_embed_video', 'has_verification_badge'] as const;
const EXPECTED_PATH = new URL('./expected.json', import.meta.url);
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

function keysOf(mask: number): readonly string[] {
    return KEYS.filter((_, index) => (mask >> index) & 1);
}

function accommodationFor(ownerId: string | undefined, extra: Record<string, unknown> = {}) {
    return {
        id: `acc-${ownerId ?? 'without-owner'}`,
        ownerId,
        name: 'Casa del Rio',
        description: 'Mira el video https://www.youtube.com/watch?v=abc123 y reserva',
        richDescription: '<p>Premium</p>',
        richDescriptionI18n: { es: '<p>Premium</p>', en: '<p>Premium en</p>' },
        isVerified: true,
        videos: [{ url: 'https://example.com/v.mp4' }],
        media: {
            featuredImage: { url: 'https://example.com/f.jpg' },
            gallery: [{ url: 'https://example.com/g.jpg' }],
            videos: [{ url: 'https://example.com/v.mp4' }]
        },
        contactInfo: { whatsapp: '+5493442000000', mobilePhone: '+5493442111111' },
        price: { price: 1000 },
        ...extra
    };
}

describe('accommodation public payload golden', () => {
    beforeEach(() => {
        mocks.effectiveSet.mockReset().mockImplementation(({ userId, vertical }) => {
            if (userId === 'owner-failing') return Promise.reject(new Error('boom'));
            const mask = Number(userId.replace('owner-', ''));
            return Promise.resolve(
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: false,
                    inheritsTouristVip: false,
                    entries: keysOf(Number.isNaN(mask) ? 0 : mask).map((key) => ({
                        key,
                        value: 1,
                        strategy: 'MAX' as const
                    }))
                })
            );
        });
    });

    it('matches the committed payloads for every combination of owner keys', async () => {
        const listings = [
            ...Array.from({ length: 8 }, (_, mask) => accommodationFor(`owner-${mask}`)),
            accommodationFor('owner-failing'),
            accommodationFor('owner-unknown', { contactInfo: null, videos: undefined }),
            accommodationFor(undefined),
            accommodationFor('owner-0', {
                id: 'acc-sparse-denied',
                richDescription: undefined,
                richDescriptionI18n: undefined,
                isVerified: undefined,
                media: { gallery: [] },
                contactInfo: { whatsapp: '   ' },
                description: undefined
            }),
            accommodationFor('owner-0', {
                id: 'acc-odd-shapes',
                media: [{ videos: ['x'] }],
                contactInfo: [],
                description: 42
            }),
            accommodationFor('owner-7', {
                id: 'acc-sparse',
                richDescription: undefined,
                richDescriptionI18n: undefined,
                isVerified: undefined,
                media: undefined,
                description: 'Plain text'
            })
        ];

        const actual = JSON.parse(
            JSON.stringify(await projectPublicAccommodations({ listings }))
        ) as unknown;

        if (UPDATE_GOLDEN) writeFileSync(EXPECTED_PATH, `${JSON.stringify(actual, null, 4)}\n`);
        expect(actual).toEqual(JSON.parse(readFileSync(EXPECTED_PATH, 'utf8')));
        expect(mocks.effectiveSet).toHaveBeenCalledWith(
            expect.objectContaining({ vertical: VerticalEnum.ACCOMMODATION })
        );
    });

    it('reads the effective set once per distinct owner', async () => {
        await projectPublicAccommodations({
            listings: [accommodationFor('owner-1'), accommodationFor('owner-1')]
        });
        expect(mocks.effectiveSet).toHaveBeenCalledTimes(1);
    });
});
