import { LifecycleStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { shouldRegenerateSlugOnDraftRename } from '../../src/utils/listing-slug-policy';

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

describe('shouldRegenerateSlugOnDraftRename', () => {
    describe('lifecycle gate', () => {
        it('regenerates for a DRAFT listing — it has no public URL to protect', () => {
            expect(shouldRegenerateSlugOnDraftRename(renameOf(LifecycleStatusEnum.DRAFT))).toBe(
                true
            );
        });

        it('keeps the slug of an ACTIVE listing', () => {
            expect(shouldRegenerateSlugOnDraftRename(renameOf(LifecycleStatusEnum.ACTIVE))).toBe(
                false
            );
        });

        it('keeps the slug of an INACTIVE listing — paused, but its URL was published', () => {
            // The enum documents INACTIVE as "was active, currently paused",
            // with "accommodation paused for vacation" as its own example. A
            // `!== ACTIVE` gate moves that listing's indexed URL on rename.
            expect(shouldRegenerateSlugOnDraftRename(renameOf(LifecycleStatusEnum.INACTIVE))).toBe(
                false
            );
        });

        it('keeps the slug of an ARCHIVED listing — retired, but its URL was published', () => {
            expect(shouldRegenerateSlugOnDraftRename(renameOf(LifecycleStatusEnum.ARCHIVED))).toBe(
                false
            );
        });

        it.each([
            ['null', null],
            ['undefined', undefined],
            ['an unrecognized value', 'PENDING_REVIEW']
        ])('keeps the slug when the lifecycle state is %s', (_label, lifecycleState) => {
            // Unknown means "cannot prove it was never published", and the
            // conservative side of that is to leave the URL alone.
            expect(shouldRegenerateSlugOnDraftRename(renameOf(lifecycleState))).toBe(false);
        });
    });

    describe('explicit slug wins', () => {
        it('keeps a caller-provided slug even on a draft rename', () => {
            expect(
                shouldRegenerateSlugOnDraftRename({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    slugWasProvided: true
                })
            ).toBe(false);
        });
    });

    describe('the name has to actually change', () => {
        it('does not regenerate when the name is unchanged', () => {
            expect(
                shouldRegenerateSlugOnDraftRename({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    nextName: 'Casa del Río'
                })
            ).toBe(false);
        });

        it('does not regenerate when the name changes only in surrounding whitespace', () => {
            expect(
                shouldRegenerateSlugOnDraftRename({
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
                shouldRegenerateSlugOnDraftRename({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    nextName
                })
            ).toBe(false);
        });

        it('regenerates when a draft with no current name is given one', () => {
            expect(
                shouldRegenerateSlugOnDraftRename({
                    ...renameOf(LifecycleStatusEnum.DRAFT),
                    currentName: null
                })
            ).toBe(true);
        });
    });
});
