import { LifecycleStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { shouldRegenerateSlugOnListingChange } from '../../src/utils/listing-slug-policy';

/**
 * A rename that would regenerate the slug if — and only if — the listing has
 * never been published. Every case below varies exactly one input away from
 * this baseline.
 */
const renameOf = (lifecycleState: string | null | undefined) => ({
    currentLifecycleState: lifecycleState,
    currentName: 'Casa del Río',
    nextName: 'Casa del Arroyo',
    slugWasProvided: false
});

/**
 * A type-only change (HOS-879): name is untouched, only the accommodation
 * type differs. `nextName` is deliberately omitted (undefined) to model a
 * real partial update payload that never touched the `name` field.
 */
const typeChangeOf = (lifecycleState: string | null | undefined) => ({
    currentLifecycleState: lifecycleState,
    currentName: 'Casa del Río',
    currentType: 'COUNTRY_HOUSE',
    nextType: 'CABIN',
    slugWasProvided: false
});

describe('shouldRegenerateSlugOnListingChange', () => {
    describe('lifecycle gate (rename)', () => {
        it('regenerates for a DRAFT listing — it has no public URL to protect', () => {
            expect(shouldRegenerateSlugOnListingChange(renameOf(LifecycleStatusEnum.DRAFT))).toBe(
                true
            );
        });

        it('keeps the slug of an ACTIVE listing', () => {
            expect(shouldRegenerateSlugOnListingChange(renameOf(LifecycleStatusEnum.ACTIVE))).toBe(
                false
            );
        });

        it('keeps the slug of an INACTIVE listing — paused, but its URL was published', () => {
            // The enum documents INACTIVE as "was active, currently paused",
            // with "accommodation paused for vacation" as its own example. A
            // `!== ACTIVE` gate moves that listing's indexed URL on rename.
            expect(
                shouldRegenerateSlugOnListingChange(renameOf(LifecycleStatusEnum.INACTIVE))
            ).toBe(false);
        });

        it('keeps the slug of an ARCHIVED listing — retired, but its URL was published', () => {
            expect(
                shouldRegenerateSlugOnListingChange(renameOf(LifecycleStatusEnum.ARCHIVED))
            ).toBe(false);
        });

        it.each([
            ['null', null],
            ['undefined', undefined],
            ['an unrecognized value', 'PENDING_REVIEW']
        ])('keeps the slug when the lifecycle state is %s', (_label, lifecycleState) => {
            // Unknown means "cannot prove it was never published", and the
            // conservative side of that is to leave the URL alone.
            expect(shouldRegenerateSlugOnListingChange(renameOf(lifecycleState))).toBe(false);
        });
    });

    describe('the published side needs an explicit opt-in (stage 2)', () => {
        it.each([
            ['ACTIVE', LifecycleStatusEnum.ACTIVE],
            ['INACTIVE', LifecycleStatusEnum.INACTIVE],
            ['ARCHIVED', LifecycleStatusEnum.ARCHIVED]
        ])('regenerates a %s listing when the owner asks for it', (_label, lifecycleState) => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(lifecycleState),
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
                    ...renameOf(LifecycleStatusEnum.ACTIVE),
                    refreshSlugFromName
                })
            ).toBe(false);
        });

        it('does not need the opt-in for a draft — it has no address to protect', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    refreshSlugFromName: false
                })
            ).toBe(true);
        });

        it('ignores the opt-in when the caller also provided a slug', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(LifecycleStatusEnum.ACTIVE),
                    slugWasProvided: true,
                    refreshSlugFromName: true
                })
            ).toBe(false);
        });

        it('ignores the opt-in when the name did not actually change', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(LifecycleStatusEnum.ACTIVE),
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
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    slugWasProvided: true
                })
            ).toBe(false);
        });
    });

    describe('the name has to actually change', () => {
        it('does not regenerate when the name is unchanged', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    nextName: 'Casa del Río'
                })
            ).toBe(false);
        });

        it('does not regenerate when the name changes only in surrounding whitespace', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
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
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    nextName
                })
            ).toBe(false);
        });

        it('regenerates when a draft with no current name is given one', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    currentName: null
                })
            ).toBe(true);
        });
    });

    describe('HOS-879: a type change is evaluated exactly like a rename', () => {
        it('DRAFT + type-only change regenerates (case 1)', () => {
            expect(
                shouldRegenerateSlugOnListingChange(typeChangeOf(LifecycleStatusEnum.DRAFT))
            ).toBe(true);
        });

        it('published + type-only change WITHOUT opt-in does not regenerate (case 2)', () => {
            expect(
                shouldRegenerateSlugOnListingChange(typeChangeOf(LifecycleStatusEnum.ACTIVE))
            ).toBe(false);
        });

        it('published + type-only change WITH opt-in regenerates (case 3)', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...typeChangeOf(LifecycleStatusEnum.ACTIVE),
                    refreshSlugFromName: true
                })
            ).toBe(true);
        });

        it('neither name nor type changes: does not regenerate (case 4)', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    currentLifecycleState: LifecycleStatusEnum.DRAFT,
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
                    currentLifecycleState: LifecycleStatusEnum.ACTIVE,
                    currentName: 'Casa del Río',
                    currentType: 'CABIN',
                    nextType: 'CABIN',
                    slugWasProvided: false,
                    refreshSlugFromName: true
                })
            ).toBe(false);
        });

        it('a type-only change on an INACTIVE (paused) listing needs the opt-in too', () => {
            expect(
                shouldRegenerateSlugOnListingChange(typeChangeOf(LifecycleStatusEnum.INACTIVE))
            ).toBe(false);
        });

        it('a caller-provided slug wins over a type change too', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    ...typeChangeOf(LifecycleStatusEnum.DRAFT),
                    slugWasProvided: true
                })
            ).toBe(false);
        });

        it('both name AND type changing on a DRAFT still regenerates', () => {
            expect(
                shouldRegenerateSlugOnListingChange({
                    currentLifecycleState: LifecycleStatusEnum.DRAFT,
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
