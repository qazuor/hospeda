import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { runWithAdministrativeAuthorization } from '../../src/utils/administrative-authorization';
import { shouldRegenerateSlugOnListingChange } from '../../src/utils/listing-slug-policy';

/**
 * A rename that would regenerate the slug if — and only if — the listing has
 * never been published. Every case below varies exactly one input away from
 * this baseline.
 */
const renameOf = (publicationStatus: string | null | undefined) => ({
    currentPublicationStatus: publicationStatus,
    currentName: 'Casa del Río',
    nextName: 'Casa del Arroyo',
    slugWasProvided: false
});

/**
 * A type-only change (HOS-879): name is untouched, only the accommodation
 * type differs. `nextName` is deliberately omitted (undefined) to model a
 * real partial update payload that never touched the `name` field.
 */
const typeChangeOf = (publicationStatus: string | null | undefined) => ({
    currentPublicationStatus: publicationStatus,
    currentName: 'Casa del Río',
    currentType: 'COUNTRY_HOUSE',
    nextType: 'CABIN',
    slugWasProvided: false
});

describe('shouldRegenerateSlugOnListingChange', () => {
    describe('publication gate (rename)', () => {
        it('regenerates for a DRAFT listing — it has no public URL to protect', () => {
            expect(shouldRegenerateSlugOnListingChange(renameOf(PublicationStatusEnum.DRAFT))).toBe(
                true
            );
        });

        it('keeps the slug of a PUBLISHED listing', () => {
            expect(
                shouldRegenerateSlugOnListingChange(renameOf(PublicationStatusEnum.PUBLISHED))
            ).toBe(false);
        });

        it.each([
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.ARCHIVED,
            PublicationStatusEnum.MODERATED,
            PublicationStatusEnum.PURGED
        ])('keeps the slug of a %s listing — taken down, but its URL was published', (status) => {
            // A `=== PUBLISHED` gate would move that listing's indexed URL on rename.
            expect(shouldRegenerateSlugOnListingChange(renameOf(status))).toBe(false);
        });

        it.each([
            ['null', null],
            ['undefined', undefined],
            ['an unrecognized value', 'PENDING_REVIEW']
        ])('keeps the slug when the publication status is %s', (_label, publicationStatus) => {
            // Unknown means "cannot prove it was never published", and the
            // conservative side of that is to leave the URL alone.
            expect(shouldRegenerateSlugOnListingChange(renameOf(publicationStatus))).toBe(false);
        });
    });

    describe('the published side needs an explicit opt-in (stage 2)', () => {
        it.each([
            ['PUBLISHED', PublicationStatusEnum.PUBLISHED],
            ['UNPUBLISHED_BY_BILLING', PublicationStatusEnum.UNPUBLISHED_BY_BILLING],
            ['ARCHIVED', PublicationStatusEnum.ARCHIVED]
        ])('regenerates a %s listing when the owner asks for it', (_label, publicationStatus) => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(publicationStatus),
                    refreshSlugFromName: true
                })
            ).toBe(true);
        });

        it.each([
            ['false', false],
            ['undefined', undefined]
        ])('keeps a published slug when the opt-in is %s', (_label, refreshSlugFromName) => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.PUBLISHED),
                    refreshSlugFromName
                })
            ).toBe(false);
        });

        it('does not need the opt-in for a draft — it has no address to protect', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.DRAFT),
                    refreshSlugFromName: false
                })
            ).toBe(true);
        });

        it('ignores the opt-in when the caller also provided a slug', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.PUBLISHED),
                    slugWasProvided: true,
                    refreshSlugFromName: true
                })
            ).toBe(false);
        });

        it('ignores the opt-in when the name did not actually change', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.PUBLISHED),
                    nextName: 'Casa del Río',
                    refreshSlugFromName: true
                })
            ).toBe(false);
        });
    });

    describe('explicit slug wins', () => {
        it('keeps a caller-provided slug even on a draft rename', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.DRAFT),
                    slugWasProvided: true
                })
            ).toBe(false);
        });
    });

    describe('the name has to actually change', () => {
        it('does not regenerate when the name is unchanged', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.DRAFT),
                    nextName: 'Casa del Río'
                })
            ).toBe(false);
        });

        it('does not regenerate when the name changes only in surrounding whitespace', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.DRAFT),
                    nextName: '  Casa del Río  '
                })
            ).toBe(false);
        });

        it.each([
            ['absent', undefined],
            ['null', null],
            ['empty', ''],
            ['whitespace only', '   ']
        ])('does not regenerate when the next name is %s', (_label, nextName) => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.DRAFT),
                    nextName
                })
            ).toBe(false);
        });

        it('regenerates when a draft with no current name is given one', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(PublicationStatusEnum.DRAFT),
                    currentName: null
                })
            ).toBe(true);
        });
    });

    describe('HOS-879: a type change is evaluated exactly like a rename', () => {
        it('DRAFT + type-only change regenerates (case 1)', () => {
            expect(
                shouldRegenerateSlugOnListingChange(typeChangeOf(PublicationStatusEnum.DRAFT))
            ).toBe(true);
        });

        it('published + type-only change WITHOUT opt-in does not regenerate (case 2)', () => {
            expect(
                shouldRegenerateSlugOnListingChange(typeChangeOf(PublicationStatusEnum.PUBLISHED))
            ).toBe(false);
        });

        it('published + type-only change WITH opt-in regenerates (case 3)', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...typeChangeOf(PublicationStatusEnum.PUBLISHED),
                    refreshSlugFromName: true
                })
            ).toBe(true);
        });

        it('neither name nor type changes: does not regenerate (case 4)', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    currentPublicationStatus: PublicationStatusEnum.DRAFT,
                    currentName: 'Casa del Río',
                    currentType: 'CABIN',
                    nextType: 'CABIN',
                    slugWasProvided: false
                })
            ).toBe(false);
        });

        it('neither name nor type changes on a published listing, even with the opt-in on', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    currentPublicationStatus: PublicationStatusEnum.PUBLISHED,
                    currentName: 'Casa del Río',
                    currentType: 'CABIN',
                    nextType: 'CABIN',
                    slugWasProvided: false,
                    refreshSlugFromName: true
                })
            ).toBe(false);
        });

        it('a type-only change on an UNPUBLISHED_BY_BILLING listing needs the opt-in too', () => {
            expect(
                shouldRegenerateSlugOnListingChange(
                    typeChangeOf(PublicationStatusEnum.UNPUBLISHED_BY_BILLING)
                )
            ).toBe(false);
        });

        it('a caller-provided slug wins over a type change too', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...typeChangeOf(PublicationStatusEnum.DRAFT),
                    slugWasProvided: true
                })
            ).toBe(false);
        });

        it('both name AND type changing on a DRAFT still regenerates', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    currentPublicationStatus: PublicationStatusEnum.DRAFT,
                    currentName: 'Casa del Río',
                    nextName: 'Casa del Arroyo',
                    currentType: 'COUNTRY_HOUSE',
                    nextType: 'CABIN',
                    slugWasProvided: false
                })
            ).toBe(true);
        });
    });
});

describe('shouldRegenerateSlugOnListingChange under action 15 (ACC:15, HOS-1493)', () => {
    const renameDraft = {
        currentPublicationStatus: PublicationStatusEnum.DRAFT,
        currentName: 'Casa del Río',
        nextName: 'Casa del Arroyo',
        slugWasProvided: false
    } as const;

    it('never moves the slug inside an action-15 scope, not even on a draft or with the opt-in', async () => {
        const results = await runWithAdministrativeAuthorization({
            authorization: { action: 'ACC_15', subjectId: 'owner-1' },
            run: async () => [
                shouldRegenerateSlugOnListingChange(renameDraft),
                shouldRegenerateSlugOnListingChange({
                    ...renameDraft,
                    currentPublicationStatus: PublicationStatusEnum.PUBLISHED,
                    refreshSlugFromName: true
                })
            ]
        });

        expect(results).toEqual([false, false]);
    });

    it('still regenerates a renamed draft outside the scope', () => {
        expect(shouldRegenerateSlugOnListingChange(renameDraft)).toBe(true);
    });
});
