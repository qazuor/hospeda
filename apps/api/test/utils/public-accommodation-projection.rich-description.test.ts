/**
 * Public projection of Markdown `description` for owners without the
 * `can_use_rich_description` key (HOS-2209).
 *
 * The write-time gate that neutralized Markdown was removed (HOS-1416), so the
 * projection is the single chokepoint: an owner without the key must publish a
 * plain `description` and plain `descriptionI18n` locales, an owner with the
 * key keeps the text untouched, and a failed effective-set read fails closed.
 *
 * @module test/utils/public-accommodation-projection.rich-description
 */
import { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

import { projectPublicAccommodations } from '../../src/utils/public-accommodation-projection';

const RICH_KEY = 'can_use_rich_description';
const MARKDOWN_DESCRIPTION = '**Bold** y <b>html</b>';
const MARKDOWN_I18N = {
    es: '**Bold** y <b>html</b>',
    en: '__Bold__ y ~~tachado~~'
};

function accommodationFor(ownerId: string) {
    return {
        id: `acc-${ownerId}`,
        ownerId,
        description: MARKDOWN_DESCRIPTION,
        descriptionI18n: { ...MARKDOWN_I18N }
    };
}

function effectiveSetFor(
    userId: string,
    vertical: VerticalEnum,
    keys: readonly string[]
): ReturnType<typeof rehydrateEffectiveSet> {
    return rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const }))
    });
}

describe('public accommodation projection: rich-description Markdown gate', () => {
    beforeEach(() => {
        mocks.effectiveSet.mockReset();
    });

    it('strips Markdown from description and every locale when the owner lacks the key', async () => {
        // Arrange
        mocks.effectiveSet.mockImplementation(({ userId, vertical }) =>
            Promise.resolve(effectiveSetFor(userId, vertical, []))
        );

        // Act
        const [item] = await projectPublicAccommodations({
            listings: [accommodationFor('owner-without-key')]
        });

        // Assert
        expect(item?.description).toBe('Bold y html');
        expect(item?.descriptionI18n).toEqual({
            es: 'Bold y html',
            en: 'Bold y tachado'
        });
        expect(mocks.effectiveSet).toHaveBeenCalledWith(
            expect.objectContaining({ vertical: VerticalEnum.ACCOMMODATION })
        );
    });

    it('leaves description and locales untouched when the owner holds the key', async () => {
        // Arrange
        mocks.effectiveSet.mockImplementation(({ userId, vertical }) =>
            Promise.resolve(effectiveSetFor(userId, vertical, [RICH_KEY]))
        );

        // Act
        const [item] = await projectPublicAccommodations({
            listings: [accommodationFor('owner-with-key')]
        });

        // Assert
        expect(item?.description).toBe(MARKDOWN_DESCRIPTION);
        expect(item?.descriptionI18n).toEqual(MARKDOWN_I18N);
    });

    it('strips Markdown when the effective-set read fails (fail closed)', async () => {
        // Arrange
        mocks.effectiveSet.mockRejectedValue(new Error('boom'));

        // Act
        const [item] = await projectPublicAccommodations({
            listings: [accommodationFor('owner-failing')]
        });

        // Assert
        expect(item?.description).toBe('Bold y html');
        expect(item?.descriptionI18n).toEqual({
            es: 'Bold y html',
            en: 'Bold y tachado'
        });
    });
});
