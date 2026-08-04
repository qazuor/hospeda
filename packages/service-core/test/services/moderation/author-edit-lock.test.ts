import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { isAuthorEditLockedByModeration } from '../../../src/services/moderation/author-edit-lock';

/**
 * HOS-374 §7.6.3 — the first write-side state gate in the codebase.
 * The predicate is deliberately narrow: APPROVED locks, everything else does
 * not, and a publish grant lifts the lock unconditionally.
 */
describe('isAuthorEditLockedByModeration', () => {
    it('locks an APPROVED entity for an author who cannot publish', () => {
        expect(
            isAuthorEditLockedByModeration({
                moderationState: ModerationStatusEnum.APPROVED,
                canPublishOwn: false
            })
        ).toBe(true);
    });

    it('does not lock a PENDING entity', () => {
        expect(
            isAuthorEditLockedByModeration({
                moderationState: ModerationStatusEnum.PENDING,
                canPublishOwn: false
            })
        ).toBe(false);
    });

    it('does not lock a REJECTED entity — the author must be able to fix it', () => {
        expect(
            isAuthorEditLockedByModeration({
                moderationState: ModerationStatusEnum.REJECTED,
                canPublishOwn: false
            })
        ).toBe(false);
    });

    it('does not lock an APPROVED entity when the author may publish their own', () => {
        expect(
            isAuthorEditLockedByModeration({
                moderationState: ModerationStatusEnum.APPROVED,
                canPublishOwn: true
            })
        ).toBe(false);
    });

    it('does not lock when the moderation state is absent', () => {
        expect(
            isAuthorEditLockedByModeration({ moderationState: null, canPublishOwn: false })
        ).toBe(false);
        expect(
            isAuthorEditLockedByModeration({ moderationState: undefined, canPublishOwn: false })
        ).toBe(false);
    });
});
