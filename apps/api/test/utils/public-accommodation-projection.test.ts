/**
 * Unit tests for the owner-gated public accommodation projection (HOS-1809).
 *
 * @module test/utils/public-accommodation-projection
 */
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

import {
    projectPublicAccommodationPage,
    projectPublicAccommodations
} from '../../src/utils/public-accommodation-projection';

const ALL = ['can_use_rich_description', 'can_embed_video', 'has_verification_badge', 'ai_chat'];
let keysByOwner: Record<string, string[]> = {};

function listing(ownerId?: string): Record<string, unknown> {
    return {
        id: `listing-${ownerId}`,
        ownerId,
        description: 'Visit https://youtube.com/watch?v=abc123 today',
        richDescription: '<p>Premium</p>',
        richDescriptionI18n: { es: '<p>Premium</p>' },
        isVerified: true,
        contactInfo: { whatsapp: '123', email: 'owner@example.test' },
        videos: [{ url: 'https://vimeo.com/123' }],
        media: { featuredImage: 'photo', videos: [{ url: 'https://vimeo.com/123' }] }
    };
}

async function project(ownerId: string | undefined) {
    const [item] = await projectPublicAccommodations({ listings: [listing(ownerId)] });
    return item as Record<string, unknown>;
}

describe('projectPublicAccommodations', () => {
    beforeEach(() => {
        keysByOwner = {};
        mocks.effectiveSet.mockReset().mockImplementation(({ userId, vertical }) =>
            userId === 'broken'
                ? Promise.reject(new Error('unavailable'))
                : Promise.resolve(
                      rehydrateEffectiveSet({
                          version: 1,
                          userId,
                          vertical,
                          hasLiveNonTrialTitle: false,
                          inheritsTouristVip: false,
                          entries: (keysByOwner[userId] ?? []).map((key) => ({
                              key,
                              value: 1,
                              strategy: 'MAX' as const
                          }))
                      })
                  )
        );
    });

    it('keeps paid fields for a granted owner without mutating the stored listing', async () => {
        keysByOwner.rich = ALL;
        const stored = listing('rich');
        const [result] = (await projectPublicAccommodations({ listings: [stored] })) as Record<
            string,
            unknown
        >[];

        expect(result?.richDescription).toBe('<p>Premium</p>');
        expect(result?.richDescriptionI18n).toEqual({ es: '<p>Premium</p>' });
        expect(result?.videos).toEqual([{ url: 'https://vimeo.com/123' }]);
        expect(result?.description).toBe('Visit https://youtube.com/watch?v=abc123 today');
        expect(result?.isVerified).toBe(true);
        expect(result?.media).toEqual({
            featuredImage: 'photo',
            videos: [{ url: 'https://vimeo.com/123' }]
        });
        expect(stored.isVerified).toBe(true);
        expect((stored.contactInfo as Record<string, unknown>).whatsapp).toBe('123');
    });

    it('never emits the WhatsApp number and derives hasWhatsapp from it', async () => {
        keysByOwner.rich = ALL;
        const result = await project('rich');
        expect(result.hasWhatsapp).toBe(true);
        expect(result.contactInfo).toEqual({ email: 'owner@example.test' });
    });

    it('omits the rich pair together and hides video and verification without grants', async () => {
        const result = await project('plain');
        expect('richDescription' in result).toBe(false);
        expect('richDescriptionI18n' in result).toBe(false);
        expect(result.isVerified).toBe(false);
        expect(result.description).toBe('Visit today');
        expect(result).not.toHaveProperty('videos');
        expect(result.media).toEqual({ featuredImage: 'photo', videos: [] });
    });

    it.each([
        ['can_use_rich_description', 'richDescription'],
        ['can_embed_video', 'videos'],
        ['has_verification_badge', 'isVerified']
    ])('%s unlocks only its own trait', async (key, field) => {
        keysByOwner.single = [key];
        const result = await project('single');
        expect(Boolean(result[field])).toBe(true);
        const others = ['richDescription', 'videos', 'isVerified'].filter((f) => f !== field);
        for (const other of others) expect(Boolean(result[other])).toBe(false);
    });

    it('fails closed when the effective set cannot be read', async () => {
        const result = await project('broken');
        expect('richDescription' in result).toBe(false);
        expect(result.isVerified).toBe(false);
        expect(result).not.toHaveProperty('videos');
    });

    it('treats a row without an owner as holding nothing', async () => {
        const result = await project(undefined);
        expect('richDescription' in result).toBe(false);
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it('reports the owner AI chat capability from the same single read', async () => {
        keysByOwner.chat = ['ai_chat'];
        const page = await projectPublicAccommodationPage({
            listings: [listing('chat'), listing('chat'), listing('none')]
        });
        expect(page.aiChatByOwner.get('chat')).toBe(true);
        expect(page.aiChatByOwner.get('none')).toBe(false);
        expect(mocks.effectiveSet).toHaveBeenCalledTimes(2);
    });

    it('Q-2 (HOS-1809): a locked calendar section removes no public field', async () => {
        // Holds every public-field key but NOT can_use_calendar, so `calendar`
        // resolves `locked`. The calendar section owns no response field, so the
        // public payload equals the one of an owner who also holds the calendar.
        keysByOwner.withoutCalendar = ALL;
        keysByOwner.withCalendar = [...ALL, 'can_use_calendar', 'can_sync_external_calendar'];
        const [without, withCalendar] = await projectPublicAccommodations({
            listings: [listing('withoutCalendar'), listing('withCalendar')]
        });

        const strip = (item: Record<string, unknown> | undefined) => ({
            ...item,
            id: undefined,
            ownerId: undefined
        });
        expect(strip(without as Record<string, unknown>)).toEqual(
            strip(withCalendar as Record<string, unknown>)
        );
        expect(without).toHaveProperty('richDescription');
        expect(without).toHaveProperty('videos');
        expect((without as Record<string, unknown>).isVerified).toBe(true);
    });
});
