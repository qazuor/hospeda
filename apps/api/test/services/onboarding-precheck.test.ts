/**
 * Unit tests for `deriveOnboardingDecision` (BETA-197).
 *
 * Covers all 6 cells of the draftCount × hasQuota decision matrix, plus the
 * boundary between the "1 draft" and ">1 drafts" rows.
 *
 * @module test/services/onboarding-precheck
 */
import { describe, expect, it } from 'vitest';
import { deriveOnboardingDecision } from '../../src/services/onboarding-precheck';

describe('deriveOnboardingDecision (BETA-197)', () => {
    it('0 drafts + quota -> create_direct', () => {
        expect(deriveOnboardingDecision({ draftCount: 0, hasQuota: true })).toBe('create_direct');
    });

    it('0 drafts + no quota -> upgrade_only', () => {
        expect(deriveOnboardingDecision({ draftCount: 0, hasQuota: false })).toBe('upgrade_only');
    });

    it('1 draft + quota -> resume_or_create', () => {
        expect(deriveOnboardingDecision({ draftCount: 1, hasQuota: true })).toBe(
            'resume_or_create'
        );
    });

    it('1 draft + no quota -> resume_delete_or_upgrade', () => {
        expect(deriveOnboardingDecision({ draftCount: 1, hasQuota: false })).toBe(
            'resume_delete_or_upgrade'
        );
    });

    it('>1 drafts + quota -> pick_draft_or_create', () => {
        expect(deriveOnboardingDecision({ draftCount: 2, hasQuota: true })).toBe(
            'pick_draft_or_create'
        );
    });

    it('>1 drafts + no quota -> pick_draft_delete_or_upgrade', () => {
        expect(deriveOnboardingDecision({ draftCount: 2, hasQuota: false })).toBe(
            'pick_draft_delete_or_upgrade'
        );
    });

    it('a larger draft count (e.g. 5) still resolves to the ">1" row', () => {
        expect(deriveOnboardingDecision({ draftCount: 5, hasQuota: true })).toBe(
            'pick_draft_or_create'
        );
        expect(deriveOnboardingDecision({ draftCount: 5, hasQuota: false })).toBe(
            'pick_draft_delete_or_upgrade'
        );
    });
});
