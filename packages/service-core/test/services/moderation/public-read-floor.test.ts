import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    applyPublicReadFloor,
    isContentStateApproved,
    PUBLIC_READ_FLOOR,
    PUBLIC_READ_FLOOR_FIELDS
} from '../../../src/services/moderation/public-read-floor';

/**
 * HOS-374 §7.6.5 — the public read floor.
 *
 * The whole value of the floor is that it wins over whatever the caller asked
 * for, so the override tests below are the load-bearing ones. Before this,
 * public post/event reads applied no filter at all — not even on `visibility`.
 */
describe('PUBLIC_READ_FLOOR', () => {
    it('pins the three state columns that together mean "public"', () => {
        expect(PUBLIC_READ_FLOOR).toEqual({
            moderationState: ModerationStatusEnum.APPROVED,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });

    it('exposes exactly those three field names', () => {
        expect([...PUBLIC_READ_FLOOR_FIELDS].sort()).toEqual([
            'lifecycleState',
            'moderationState',
            'visibility'
        ]);
    });
});

describe('applyPublicReadFloor', () => {
    it('adds the floor to a filter object that carries none', () => {
        expect(applyPublicReadFloor({ isNews: true })).toEqual({
            isNews: true,
            ...PUBLIC_READ_FLOOR
        });
    });

    it('overrides a caller-supplied visibility', () => {
        // The bypass this closes: any authenticated caller could pass
        // `?visibility=PRIVATE` and read other people's unpublished content.
        const result = applyPublicReadFloor({ visibility: VisibilityEnum.PRIVATE });
        expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
    });

    it('overrides a caller-supplied moderationState', () => {
        const result = applyPublicReadFloor({ moderationState: ModerationStatusEnum.PENDING });
        expect(result.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('overrides a caller-supplied lifecycleState', () => {
        const result = applyPublicReadFloor({ lifecycleState: LifecycleStatusEnum.ARCHIVED });
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('leaves every other filter untouched', () => {
        const filters = { category: 'news', authorId: 'user-1', isFeatured: true };
        expect(applyPublicReadFloor(filters)).toEqual({ ...filters, ...PUBLIC_READ_FLOOR });
    });

    it('does not mutate the object it was given', () => {
        const filters: Record<string, unknown> = { isNews: true };
        applyPublicReadFloor(filters);
        expect(filters).toEqual({ isNews: true });
    });
});

describe('isContentStateApproved', () => {
    it('accepts approved and active content', () => {
        expect(
            isContentStateApproved({
                moderationState: ModerationStatusEnum.APPROVED,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            })
        ).toBe(true);
    });

    it('rejects pending content', () => {
        expect(
            isContentStateApproved({
                moderationState: ModerationStatusEnum.PENDING,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            })
        ).toBe(false);
    });

    it('rejects rejected content', () => {
        expect(
            isContentStateApproved({
                moderationState: ModerationStatusEnum.REJECTED,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            })
        ).toBe(false);
    });

    it('rejects archived content even when it was approved', () => {
        expect(
            isContentStateApproved({
                moderationState: ModerationStatusEnum.APPROVED,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            })
        ).toBe(false);
    });

    it('rejects content whose state columns are absent', () => {
        expect(isContentStateApproved({})).toBe(false);
        expect(isContentStateApproved({ moderationState: null, lifecycleState: null })).toBe(false);
    });

    it('does not consider visibility — that stays with the permission helpers', () => {
        // A PRIVATE row still clears this predicate; `checkCanViewPost` /
        // `checkCanViewEvent` own the visibility decision, including the
        // author and *_VIEW_PRIVATE exceptions. Two answers to one question
        // is how those exceptions get silently lost.
        expect(
            isContentStateApproved({
                moderationState: ModerationStatusEnum.APPROVED,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            })
        ).toBe(true);
    });
});
