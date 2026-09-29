/**
 * @file safe-external-url.write-schemas.test.ts
 * @description HOS-703: every user-authored third-party URL INPUT schema refuses
 * non-http(s) schemes, while the entity / response schemas stay tolerant of rows
 * already stored (a stricter read contract means permanent 500s).
 */
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
    AccommodationCreateDraftHttpSchema,
    AccommodationCreateHttpSchema
} from '../../entities/accommodation/accommodation.http.schema.js';
import { EventOrganizerCreateHttpSchema } from '../../entities/eventOrganizer/eventOrganizer.http.schema.js';
import { ExperienceCreateHttpSchema } from '../../entities/experience/experience.http.schema.js';
import { GastronomyCreateHttpSchema } from '../../entities/gastronomy/gastronomy.http.schema.js';
import { PartnerOwnerUpdateSchema } from '../../entities/partner/partner.owner.schema.js';
import { partnerSchema } from '../../entities/partner/partner.schema.js';
import { updatePartnerSchema } from '../../entities/partner/partner.update.schema.js';
import { partnerMentionEntrySchema } from '../../entities/partner/partner-mention.create.schema.js';
import { partnerMentionSchema } from '../../entities/partner/partner-mention.schema.js';
import { updatePartnerMentionSchema } from '../../entities/partner/partner-mention.update.schema.js';
import { PostSponsorCreateHttpSchema } from '../../entities/postSponsor/postSponsor.http.schema.js';
import { SponsorshipCreateHttpSchema } from '../../entities/sponsorship/sponsorship.http.schema.js';
import {
    SponsorshipCreateInputSchema,
    SponsorshipSchema
} from '../../entities/sponsorship/sponsorship.schema.js';
import {
    UserProfileReadSchema,
    UserProfileSchema
} from '../../entities/user/user.profile.schema.js';
import { CompleteProfileBodySchema } from '../../entities/user/user.profile-completion.schema.js';
import { ProfileEditSchema } from '../../user/profile.js';
import { ContactInfoSchema } from '../contact.schema.js';

const BAD = 'javascript:alert(1)';
const GOOD = 'https://example.com/x';

/** [label, field schema] pairs for every input field hardened by HOS-703. */
const INPUT_FIELDS: ReadonlyArray<readonly [string, ZodType]> = [
    ['ContactInfoSchema.website', ContactInfoSchema.shape.website],
    ['EventOrganizerCreateHttp.website', EventOrganizerCreateHttpSchema.shape.website],
    ['EventOrganizerCreateHttp.twitter', EventOrganizerCreateHttpSchema.shape.twitter],
    ['EventOrganizerCreateHttp.facebook', EventOrganizerCreateHttpSchema.shape.facebook],
    ['EventOrganizerCreateHttp.instagram', EventOrganizerCreateHttpSchema.shape.instagram],
    ['EventOrganizerCreateHttp.linkedin', EventOrganizerCreateHttpSchema.shape.linkedin],
    ['PostSponsorCreateHttp.website', PostSponsorCreateHttpSchema.shape.website],
    ['PostSponsorCreateHttp.twitter', PostSponsorCreateHttpSchema.shape.twitter],
    ['PostSponsorCreateHttp.facebook', PostSponsorCreateHttpSchema.shape.facebook],
    ['PostSponsorCreateHttp.instagram', PostSponsorCreateHttpSchema.shape.instagram],
    ['PostSponsorCreateHttp.linkedin', PostSponsorCreateHttpSchema.shape.linkedin],
    ['AccommodationCreateHttp.website', AccommodationCreateHttpSchema.shape.website],
    ['AccommodationCreateHttp.twitter', AccommodationCreateHttpSchema.shape.twitter],
    ['AccommodationCreateHttp.facebook', AccommodationCreateHttpSchema.shape.facebook],
    ['AccommodationCreateHttp.instagram', AccommodationCreateHttpSchema.shape.instagram],
    ['AccommodationCreateHttp.linkedin', AccommodationCreateHttpSchema.shape.linkedin],
    ['AccommodationCreateHttp.tiktok', AccommodationCreateHttpSchema.shape.tiktok],
    ['AccommodationCreateHttp.youtube', AccommodationCreateHttpSchema.shape.youtube],
    ['AccommodationCreateDraftHttp.website', AccommodationCreateDraftHttpSchema.shape.website],
    ['ExperienceCreateHttp.website', ExperienceCreateHttpSchema.shape.website],
    ['ExperienceCreateHttp.twitter', ExperienceCreateHttpSchema.shape.twitter],
    ['ExperienceCreateHttp.facebook', ExperienceCreateHttpSchema.shape.facebook],
    ['ExperienceCreateHttp.instagram', ExperienceCreateHttpSchema.shape.instagram],
    ['ExperienceCreateHttp.linkedin', ExperienceCreateHttpSchema.shape.linkedin],
    ['ExperienceCreateHttp.tiktok', ExperienceCreateHttpSchema.shape.tiktok],
    ['ExperienceCreateHttp.youtube', ExperienceCreateHttpSchema.shape.youtube],
    ['GastronomyCreateHttp.website', GastronomyCreateHttpSchema.shape.website],
    ['GastronomyCreateHttp.twitter', GastronomyCreateHttpSchema.shape.twitter],
    ['GastronomyCreateHttp.facebook', GastronomyCreateHttpSchema.shape.facebook],
    ['GastronomyCreateHttp.instagram', GastronomyCreateHttpSchema.shape.instagram],
    ['GastronomyCreateHttp.linkedin', GastronomyCreateHttpSchema.shape.linkedin],
    ['GastronomyCreateHttp.tiktok', GastronomyCreateHttpSchema.shape.tiktok],
    ['GastronomyCreateHttp.youtube', GastronomyCreateHttpSchema.shape.youtube],
    ['SponsorshipCreateHttp.linkUrl', SponsorshipCreateHttpSchema.shape.linkUrl],
    ['SponsorshipCreateInput.linkUrl', SponsorshipCreateInputSchema.shape.linkUrl],
    ['UserProfile.website', UserProfileSchema.shape.website],
    ['ProfileEdit.website', ProfileEditSchema.shape.website],
    ['PartnerMention update.url', updatePartnerMentionSchema.shape.url]
];

describe('user-authored third-party URL inputs refuse non-http(s) schemes (HOS-703)', () => {
    it.each(INPUT_FIELDS)('%s rejects a javascript: URL', (_label, field) => {
        expect(field.safeParse(BAD).success).toBe(false);
    });

    it.each(INPUT_FIELDS)('%s still accepts an https URL', (_label, field) => {
        expect(field.safeParse(GOOD).success).toBe(true);
    });

    it('the profile-completion body rejects javascript: in website and every social', () => {
        const body = CompleteProfileBodySchema.shape;
        expect(body.website.safeParse(BAD).success).toBe(false);
        expect(body.website.safeParse(GOOD).success).toBe(true);
        const networks = body.socialNetworks.unwrap();
        for (const key of [
            'facebook',
            'instagram',
            'twitter',
            'linkedIn',
            'tiktok',
            'youtube'
        ] as const) {
            expect(networks.shape[key].safeParse(BAD).success, key).toBe(false);
            expect(networks.shape[key].safeParse(GOOD).success, key).toBe(true);
        }
    });

    it('a partner-mention entry refuses a javascript: link', () => {
        expect(
            partnerMentionEntrySchema.safeParse({ channel: 'INSTAGRAM', url: BAD }).success
        ).toBe(false);
        expect(
            partnerMentionEntrySchema.safeParse({ channel: 'INSTAGRAM', url: GOOD }).success
        ).toBe(true);
    });

    it('partner contactInfo.website is refused by the admin and owner write schemas', () => {
        expect(updatePartnerSchema.safeParse({ contactInfo: { website: BAD } }).success).toBe(
            false
        );
        expect(PartnerOwnerUpdateSchema.safeParse({ contactInfo: { website: BAD } }).success).toBe(
            false
        );
        expect(PartnerOwnerUpdateSchema.safeParse({ contactInfo: { website: GOOD } }).success).toBe(
            true
        );
    });
});

describe('entity / response schemas stay tolerant of stored rows (HOS-703)', () => {
    it('sponsorship, partner mention, partner contactInfo and user profile READ schemas still parse', () => {
        expect(SponsorshipSchema.shape.linkUrl.safeParse(BAD).success).toBe(true);
        expect(partnerMentionSchema.shape.url.safeParse(BAD).success).toBe(true);
        expect(partnerSchema.shape.contactInfo.safeParse({ website: BAD }).success).toBe(true);
        expect(UserProfileReadSchema.shape.website.safeParse(BAD).success).toBe(true);
    });
});
