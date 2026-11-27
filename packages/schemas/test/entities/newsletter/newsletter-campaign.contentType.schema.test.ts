/**
 * @file newsletter-campaign.contentType.schema.test.ts
 * @description Locks the wire shape of the `contentType` field added to the
 * newsletter campaign schemas in Phase 6 of feat/newsletter-polish. The field
 * gates audience segmentation at dispatch time, so silent drift between the
 * base schema, create body, update body, and DB column would let invalid
 * values reach the database.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    CreateNewsletterCampaignSchema,
    UpdateNewsletterCampaignSchema
} from '../../../src/entities/newsletter/newsletter-campaign.crud.schema.js';
import { NewsletterCampaignSchema } from '../../../src/entities/newsletter/newsletter-campaign.schema.js';
import { NewsletterContentTypeEnum } from '../../../src/enums/newsletter-content-type.enum.js';

const validCampaignBase = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    title: 'Mayo 2026',
    subject: 'Novedades — mayo',
    bodyJson: { type: 'doc' as const, content: [] },
    status: 'draft' as const,
    localeFilter: 'es' as const,
    totalRecipients: null,
    totalSoftcapped: 0,
    sentAt: null,
    scheduledFor: null,
    createdBy: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
};

describe('NewsletterCampaignSchema resolved content', () => {
    const campaign = { ...validCampaignBase, contentType: null };

    it('accepts historical campaigns without resolution fields', () => {
        const parsed = NewsletterCampaignSchema.parse(campaign);
        expect(parsed).not.toHaveProperty('resolvedBodyJson');
        expect(parsed).not.toHaveProperty('resolvedAt');
    });

    it('accepts explicit null resolution fields on unresolved campaigns', () => {
        const parsed = NewsletterCampaignSchema.parse({
            ...campaign,
            resolvedBodyJson: null,
            resolvedAt: null
        });
        expect(parsed.resolvedBodyJson).toBeNull();
        expect(parsed.resolvedAt).toBeNull();
    });

    it.each([
        new Date('2026-11-26T12:00:00Z'),
        '2026-11-26T12:00:00Z'
    ])('preserves resolved documents and timestamp %s', (resolvedAt) => {
        const resolvedBodyJson = {
            version: 1,
            doc: {
                type: 'doc',
                content: [{ type: 'dynamicBlock', attrs: { blockKey: 'newest-block' } }]
            },
            blocks: [
                {
                    blockKey: 'newest-block',
                    hidden: false,
                    itemIds: ['item-one'],
                    cards: {
                        'item-one': {
                            es: {
                                name: 'House',
                                summary: 'Stay',
                                imageUrl: null,
                                url: 'https://hospeda.test/house/'
                            }
                        }
                    }
                }
            ]
        };
        const parsed = NewsletterCampaignSchema.parse({
            ...campaign,
            resolvedBodyJson,
            resolvedAt
        });
        expect(parsed.resolvedBodyJson).toEqual(resolvedBodyJson);
        expect(parsed.resolvedAt).toEqual(resolvedAt);
    });

    it('rejects malformed resolved documents', () => {
        expect(
            NewsletterCampaignSchema.safeParse({
                ...campaign,
                resolvedBodyJson: { type: 'paragraph' }
            }).success
        ).toBe(false);
    });

    it('rejects malformed resolution timestamps', () => {
        expect(
            NewsletterCampaignSchema.safeParse({ ...campaign, resolvedAt: 'yesterday' }).success
        ).toBe(false);
    });
});

describe('NewsletterCampaignSchema.contentType', () => {
    it('accepts null (legacy no-segmentation default)', () => {
        const parsed = NewsletterCampaignSchema.parse({
            ...validCampaignBase,
            contentType: null
        });
        expect(parsed.contentType).toBeNull();
    });

    it.each(
        Object.values(NewsletterContentTypeEnum)
    )('accepts each NewsletterContentTypeEnum value (%s)', (value) => {
        const parsed = NewsletterCampaignSchema.parse({
            ...validCampaignBase,
            contentType: value
        });
        expect(parsed.contentType).toBe(value);
    });

    it('rejects an unknown content type string', () => {
        expect(() =>
            NewsletterCampaignSchema.parse({
                ...validCampaignBase,
                contentType: 'announcements'
            })
        ).toThrow(ZodError);
    });

    it('rejects an undefined value (field is required, even when nullable)', () => {
        // Field is `.nullable()` not `.optional()` on the base, so it must be present.
        const { ...withoutContentType } = validCampaignBase;
        expect(() => NewsletterCampaignSchema.parse(withoutContentType)).toThrow(ZodError);
    });
});

describe('CreateNewsletterCampaignSchema.contentType', () => {
    const validCreate = {
        title: 'Mayo 2026',
        subject: 'Novedades — mayo',
        bodyJson: { type: 'doc' as const, content: [] }
    };

    it('treats contentType as optional (omitted body still parses)', () => {
        const parsed = CreateNewsletterCampaignSchema.parse(validCreate);
        expect(parsed.contentType).toBeUndefined();
    });

    it('accepts explicit null contentType', () => {
        const parsed = CreateNewsletterCampaignSchema.parse({
            ...validCreate,
            contentType: null
        });
        expect(parsed.contentType).toBeNull();
    });

    it('accepts a valid NewsletterContentTypeEnum value', () => {
        const parsed = CreateNewsletterCampaignSchema.parse({
            ...validCreate,
            contentType: NewsletterContentTypeEnum.OFFERS
        });
        expect(parsed.contentType).toBe(NewsletterContentTypeEnum.OFFERS);
    });

    it('rejects an unknown contentType', () => {
        expect(() =>
            CreateNewsletterCampaignSchema.parse({ ...validCreate, contentType: 'bogus' })
        ).toThrow(ZodError);
    });

    it('rejects unknown extra fields (.strict())', () => {
        expect(() =>
            CreateNewsletterCampaignSchema.parse({
                ...validCreate,
                contentType: NewsletterContentTypeEnum.OFFERS,
                segment: 'vip'
            })
        ).toThrow(ZodError);
    });
});

describe('UpdateNewsletterCampaignSchema.contentType', () => {
    it('accepts a single-field contentType partial', () => {
        const parsed = UpdateNewsletterCampaignSchema.parse({
            contentType: NewsletterContentTypeEnum.EVENTS
        });
        expect(parsed.contentType).toBe(NewsletterContentTypeEnum.EVENTS);
    });

    it('accepts null to clear segmentation', () => {
        const parsed = UpdateNewsletterCampaignSchema.parse({ contentType: null });
        expect(parsed.contentType).toBeNull();
    });

    it('rejects unknown enum values', () => {
        expect(() => UpdateNewsletterCampaignSchema.parse({ contentType: 'foo' })).toThrow(
            ZodError
        );
    });

    it('rejects unknown fields (.strict())', () => {
        expect(() =>
            UpdateNewsletterCampaignSchema.parse({
                contentType: NewsletterContentTypeEnum.GUIDES,
                segment: 'vip'
            })
        ).toThrow(ZodError);
    });
});
