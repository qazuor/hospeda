/**
 * @file AnnouncementForm.test.ts
 * @description Unit tests for the shared <AnnouncementForm> validation
 * helper used by both the create page (T-039) and the edit page (T-040).
 * The component render path is exercised by the page-level source-based
 * tests and the manual smoke (T-042); here we pin the pure validation logic
 * since it is the single most regression-prone piece.
 */

import { describe, expect, it } from 'vitest';
import { buildAnnouncementItem } from '../../../src/features/announcements/AnnouncementForm';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

function makeState(
    overrides: Partial<{
        textEs: string;
        textEn: string;
        textPt: string;
        variant: 'info' | 'warning' | 'danger';
        dismissible: boolean;
        startsAt: string;
        endsAt: string;
    }> = {}
) {
    return {
        textEs: 'Hola',
        textEn: 'Hello',
        textPt: 'Olá',
        variant: 'info' as const,
        dismissible: true,
        startsAt: '',
        endsAt: '',
        ...overrides
    };
}

describe('buildAnnouncementItem', () => {
    it('builds a valid item when all 3 locales + variant + dismissible are set', () => {
        const result = buildAnnouncementItem({ id: VALID_ID, state: makeState() });
        expect('item' in result).toBe(true);
        if ('item' in result) {
            expect(result.item.id).toBe(VALID_ID);
            expect(result.item.text).toEqual({ es: 'Hola', en: 'Hello', pt: 'Olá' });
            expect(result.item.variant).toBe('info');
            expect(result.item.dismissible).toBe(true);
            expect(result.item.startsAt).toBeUndefined();
            expect(result.item.endsAt).toBeUndefined();
        }
    });

    it('trims whitespace around the text inputs before persisting', () => {
        const result = buildAnnouncementItem({
            id: VALID_ID,
            state: makeState({ textEs: '  Hola  ', textEn: ' Hello ', textPt: 'Olá ' })
        });
        if ('item' in result) {
            expect(result.item.text).toEqual({ es: 'Hola', en: 'Hello', pt: 'Olá' });
        } else {
            throw new Error('expected valid item');
        }
    });

    describe('text requirement', () => {
        it('rejects when textEs is blank', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ textEs: '' })
            });
            expect('error' in result && result.error).toBe('requiredText');
        });

        it('rejects when textEn is blank', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ textEn: '' })
            });
            expect('error' in result && result.error).toBe('requiredText');
        });

        it('rejects when textPt is blank', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ textPt: '' })
            });
            expect('error' in result && result.error).toBe('requiredText');
        });

        it('rejects when all three are blank', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ textEs: '', textEn: '', textPt: '' })
            });
            expect('error' in result && result.error).toBe('requiredText');
        });

        it('rejects when text is only whitespace', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ textEs: '   ' })
            });
            expect('error' in result && result.error).toBe('requiredText');
        });
    });

    describe('date window', () => {
        it('persists startsAt + endsAt as ISO-8601 strings when set', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({
                    startsAt: '2026-06-01T00:00',
                    endsAt: '2026-06-02T00:00'
                })
            });
            if ('item' in result) {
                expect(result.item.startsAt).toBeDefined();
                expect(result.item.endsAt).toBeDefined();
                // Must round-trip through ISO with offset
                expect(result.item.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            } else {
                throw new Error('expected valid item');
            }
        });

        it('rejects when endsAt is equal to startsAt', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({
                    startsAt: '2026-06-01T00:00',
                    endsAt: '2026-06-01T00:00'
                })
            });
            expect('error' in result && result.error).toBe('endBeforeStart');
        });

        it('rejects when endsAt is before startsAt', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({
                    startsAt: '2026-06-02T00:00',
                    endsAt: '2026-06-01T00:00'
                })
            });
            expect('error' in result && result.error).toBe('endBeforeStart');
        });

        it('accepts startsAt without endsAt (open-ended after)', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ startsAt: '2026-06-01T00:00' })
            });
            expect('item' in result).toBe(true);
        });

        it('accepts endsAt without startsAt (open-ended before)', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ endsAt: '2026-06-01T00:00' })
            });
            expect('item' in result).toBe(true);
        });
    });

    describe('variant + dismissible', () => {
        it('preserves the warning variant', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ variant: 'warning' })
            });
            if ('item' in result) {
                expect(result.item.variant).toBe('warning');
            }
        });

        it('preserves the danger variant', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ variant: 'danger' })
            });
            if ('item' in result) {
                expect(result.item.variant).toBe('danger');
            }
        });

        it('persists dismissible=false', () => {
            const result = buildAnnouncementItem({
                id: VALID_ID,
                state: makeState({ dismissible: false })
            });
            if ('item' in result) {
                expect(result.item.dismissible).toBe(false);
            }
        });
    });

    it('rejects with `invalid` when id is not a UUID (Zod gate)', () => {
        const result = buildAnnouncementItem({ id: 'not-a-uuid', state: makeState() });
        expect('error' in result && result.error).toBe('invalid');
    });
});
