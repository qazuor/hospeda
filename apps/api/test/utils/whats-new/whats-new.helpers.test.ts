/**
 * @file whats-new.helpers.test.ts
 *
 * Unit tests for the pure What's New server helper functions (SPEC-175 T-005).
 *
 * Covers (per SPEC-175 §12.5):
 * - filterEntriesByRole: absent roles, empty array, matching, non-matching.
 * - computeSeen: baseline boundary, above-baseline unseen, explicit seenIds.
 * - resolveEntryLocale: es-only field with en/pt requests (fallback to es).
 *
 * @see SPEC-175 §6.5, §6.7, §12.5
 */
import type { WhatsNewEntry } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    computeSeen,
    filterEntriesByRole,
    resolveEntryLocale
} from '../../../src/utils/whats-new/whats-new.helpers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeEntry = (overrides: Partial<WhatsNewEntry> = {}): WhatsNewEntry => ({
    id: 'test-entry',
    publishedAt: '2026-05-01T00:00:00Z',
    highlight: false,
    title: { es: 'Título' },
    body: { es: 'Cuerpo de la entrada.' },
    ...overrides
});

// ---------------------------------------------------------------------------
// filterEntriesByRole
// ---------------------------------------------------------------------------

describe('filterEntriesByRole', () => {
    const universal = makeEntry({ id: 'universal', roles: undefined });
    const emptyRoles = makeEntry({ id: 'empty-roles', roles: [] });
    const adminOnly = makeEntry({ id: 'admin-only', roles: ['ADMIN', 'SUPER_ADMIN'] });
    const hostOnly = makeEntry({ id: 'host-only', roles: ['HOST'] });
    const multiRole = makeEntry({ id: 'multi', roles: ['HOST', 'EDITOR'] });

    it('should return all entries when role is HOST and roles field is absent', () => {
        const result = filterEntriesByRole({ entries: [universal], role: 'HOST' });
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('universal');
    });

    it('should return all entries when role is HOST and roles is empty array', () => {
        const result = filterEntriesByRole({ entries: [emptyRoles], role: 'HOST' });
        expect(result).toHaveLength(1);
    });

    it('should return ADMIN-targeted entry for ADMIN role', () => {
        const result = filterEntriesByRole({ entries: [adminOnly], role: 'ADMIN' });
        expect(result).toHaveLength(1);
    });

    it('should exclude ADMIN-targeted entry for HOST role', () => {
        const result = filterEntriesByRole({ entries: [adminOnly], role: 'HOST' });
        expect(result).toHaveLength(0);
    });

    it('should exclude HOST-targeted entry for EDITOR role', () => {
        const result = filterEntriesByRole({ entries: [hostOnly], role: 'EDITOR' });
        expect(result).toHaveLength(0);
    });

    it('should include multi-role entry when actor role matches one of the roles', () => {
        const result = filterEntriesByRole({ entries: [multiRole], role: 'HOST' });
        expect(result).toHaveLength(1);
    });

    it('should include multi-role entry when actor role is EDITOR', () => {
        const result = filterEntriesByRole({ entries: [multiRole], role: 'EDITOR' });
        expect(result).toHaveLength(1);
    });

    it('should exclude multi-role entry when actor role is ADMIN (not in list)', () => {
        const result = filterEntriesByRole({ entries: [multiRole], role: 'ADMIN' });
        expect(result).toHaveLength(0);
    });

    it('should return empty array when role is null', () => {
        const result = filterEntriesByRole({ entries: [universal, adminOnly], role: null });
        expect(result).toHaveLength(0);
    });

    it('should return empty array when role is undefined', () => {
        const result = filterEntriesByRole({
            entries: [universal, adminOnly],
            role: undefined
        });
        expect(result).toHaveLength(0);
    });

    it('should return empty array when entries is empty', () => {
        const result = filterEntriesByRole({ entries: [], role: 'HOST' });
        expect(result).toHaveLength(0);
    });

    it('should handle mixed entries and return only applicable ones', () => {
        const result = filterEntriesByRole({
            entries: [universal, adminOnly, hostOnly, multiRole],
            role: 'HOST'
        });
        // universal, hostOnly, multiRole — not adminOnly
        expect(result).toHaveLength(3);
        expect(result.map((e) => e.id)).toEqual(
            expect.arrayContaining(['universal', 'host-only', 'multi'])
        );
        expect(result.map((e) => e.id)).not.toContain('admin-only');
    });
});

// ---------------------------------------------------------------------------
// computeSeen
// ---------------------------------------------------------------------------

describe('computeSeen', () => {
    const baselineAt = '2026-05-01T00:00:00Z';

    it('should return true when entry.publishedAt equals baselineAt (boundary)', () => {
        const entry = makeEntry({ id: 'boundary', publishedAt: '2026-05-01T00:00:00Z' });
        expect(computeSeen({ entry, seenIds: [], baselineAt })).toBe(true);
    });

    it('should return true when entry.publishedAt is before baselineAt', () => {
        const entry = makeEntry({ id: 'before', publishedAt: '2026-01-01T00:00:00Z' });
        expect(computeSeen({ entry, seenIds: [], baselineAt })).toBe(true);
    });

    it('should return false when entry.publishedAt is after baselineAt and id not in seenIds', () => {
        const entry = makeEntry({ id: 'after', publishedAt: '2026-06-01T00:00:00Z' });
        expect(computeSeen({ entry, seenIds: [], baselineAt })).toBe(false);
    });

    it('should return true when entry.publishedAt is after baselineAt but id is in seenIds', () => {
        const entry = makeEntry({ id: 'after-seen', publishedAt: '2026-06-01T00:00:00Z' });
        expect(computeSeen({ entry, seenIds: ['after-seen', 'other'], baselineAt })).toBe(true);
    });

    it('should return false when id is not in seenIds and publishedAt is after baseline', () => {
        const entry = makeEntry({ id: 'unseen', publishedAt: '2026-12-01T00:00:00Z' });
        expect(computeSeen({ entry, seenIds: ['something-else'], baselineAt })).toBe(false);
    });

    it('should check seenIds before baseline comparison (short-circuit)', () => {
        // Even if publishedAt > baselineAt, seenIds wins
        const entry = makeEntry({ id: 'future', publishedAt: '2030-01-01T00:00:00Z' });
        expect(computeSeen({ entry, seenIds: ['future'], baselineAt })).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// resolveEntryLocale
// ---------------------------------------------------------------------------

describe('resolveEntryLocale', () => {
    describe('when the field has only es (required)', () => {
        const field = { es: 'Título en español' };

        it('should return es when locale is "en" and en is absent', () => {
            expect(resolveEntryLocale({ field, locale: 'en' })).toBe('Título en español');
        });

        it('should return es when locale is "pt" and pt is absent', () => {
            expect(resolveEntryLocale({ field, locale: 'pt' })).toBe('Título en español');
        });

        it('should return es when locale is "es"', () => {
            expect(resolveEntryLocale({ field, locale: 'es' })).toBe('Título en español');
        });

        it('should return es when locale is null', () => {
            expect(resolveEntryLocale({ field, locale: null })).toBe('Título en español');
        });

        it('should return es when locale is undefined', () => {
            expect(resolveEntryLocale({ field, locale: undefined })).toBe('Título en español');
        });
    });

    describe('when the field has es and en', () => {
        const field = { es: 'Título', en: 'Title' };

        it('should return en when locale is "en"', () => {
            expect(resolveEntryLocale({ field, locale: 'en' })).toBe('Title');
        });

        it('should return es when locale is "pt" and pt is absent', () => {
            expect(resolveEntryLocale({ field, locale: 'pt' })).toBe('Título');
        });

        it('should return es when locale is "es"', () => {
            expect(resolveEntryLocale({ field, locale: 'es' })).toBe('Título');
        });
    });

    describe('when the field has es and pt', () => {
        const field = { es: 'Título', pt: 'Título PT' };

        it('should return pt when locale is "pt"', () => {
            expect(resolveEntryLocale({ field, locale: 'pt' })).toBe('Título PT');
        });

        it('should return es when locale is "en" and en is absent', () => {
            expect(resolveEntryLocale({ field, locale: 'en' })).toBe('Título');
        });
    });

    describe('when the field has all three locales', () => {
        const field = { es: 'Título ES', en: 'Title EN', pt: 'Título PT' };

        it('should return en for en locale', () => {
            expect(resolveEntryLocale({ field, locale: 'en' })).toBe('Title EN');
        });

        it('should return pt for pt locale', () => {
            expect(resolveEntryLocale({ field, locale: 'pt' })).toBe('Título PT');
        });

        it('should return es for es locale', () => {
            expect(resolveEntryLocale({ field, locale: 'es' })).toBe('Título ES');
        });
    });
});
