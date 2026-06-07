import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

describe('SPEC-195 MODERATION permissions', () => {
    it('should have MODERATION category in PermissionCategoryEnum', () => {
        expect(PermissionCategoryEnum.MODERATION).toBe('MODERATION');
    });

    it('should have 6 term permissions', () => {
        expect(PermissionEnum.MODERATION_TERM_VIEW).toBe('moderation.term.view');
        expect(PermissionEnum.MODERATION_TERM_CREATE).toBe('moderation.term.create');
        expect(PermissionEnum.MODERATION_TERM_UPDATE).toBe('moderation.term.update');
        expect(PermissionEnum.MODERATION_TERM_DELETE).toBe('moderation.term.delete');
        expect(PermissionEnum.MODERATION_TERM_RESTORE).toBe('moderation.term.restore');
        expect(PermissionEnum.MODERATION_TERM_HARD_DELETE).toBe('moderation.term.hardDelete');
    });

    it('should have 4 threshold permissions', () => {
        expect(PermissionEnum.MODERATION_THRESHOLD_VIEW).toBe('moderation.threshold.view');
        expect(PermissionEnum.MODERATION_THRESHOLD_UPDATE).toBe('moderation.threshold.update');
        expect(PermissionEnum.MODERATION_THRESHOLD_RESTORE).toBe('moderation.threshold.restore');
        expect(PermissionEnum.MODERATION_THRESHOLD_HARD_DELETE).toBe(
            'moderation.threshold.hardDelete'
        );
    });

    it('should have exactly 10 new MODERATION entries', () => {
        const moderationPerms = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('moderation.')
        );
        expect(moderationPerms).toHaveLength(10);
    });
});
