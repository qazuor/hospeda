/**
 * @file helpers.test.ts
 * @description Unit tests for the announcement editor helpers
 * (SPEC-156 PR-4 T-038/T-039/T-040 shared helpers).
 */

import type { AnnouncementItem } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    classifyWindow,
    formatWindowDate,
    pickPreviewText,
    pickVariantBadgeVariant
} from '../../../src/features/announcements/helpers';

function makeItem(overrides: Partial<AnnouncementItem> = {}): AnnouncementItem {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        text: { es: 'Hola', en: 'Hello', pt: 'Olá' },
        variant: 'info',
        dismissible: true,
        ...overrides
    };
}

describe('classifyWindow', () => {
    it('returns alwaysOn when neither bound is set', () => {
        expect(classifyWindow(makeItem())).toBe('alwaysOn');
    });

    it('returns startsAt when only the lower bound is set', () => {
        expect(classifyWindow(makeItem({ startsAt: '2026-06-01T00:00:00.000Z' }))).toBe('startsAt');
    });

    it('returns endsAt when only the upper bound is set', () => {
        expect(classifyWindow(makeItem({ endsAt: '2026-12-31T00:00:00.000Z' }))).toBe('endsAt');
    });

    it('returns between when both bounds are set', () => {
        expect(
            classifyWindow(
                makeItem({
                    startsAt: '2026-06-01T00:00:00.000Z',
                    endsAt: '2026-07-01T00:00:00.000Z'
                })
            )
        ).toBe('between');
    });
});

describe('pickVariantBadgeVariant', () => {
    it('maps info -> outline', () => {
        expect(pickVariantBadgeVariant('info')).toBe('outline');
    });

    it('maps warning -> default', () => {
        expect(pickVariantBadgeVariant('warning')).toBe('default');
    });

    it('maps danger -> destructive', () => {
        expect(pickVariantBadgeVariant('danger')).toBe('destructive');
    });
});

describe('formatWindowDate', () => {
    it('returns null when the date is missing', () => {
        expect(formatWindowDate(undefined, 'es')).toBeNull();
    });

    it('returns null when the date is invalid', () => {
        expect(formatWindowDate('garbage', 'es')).toBeNull();
    });

    it('returns a non-empty string when the ISO is valid', () => {
        const out = formatWindowDate('2026-06-01T00:00:00.000Z', 'es');
        expect(out).not.toBeNull();
        expect((out ?? '').length).toBeGreaterThan(0);
    });
});

describe('pickPreviewText', () => {
    it('prefers the Spanish copy by default', () => {
        const out = pickPreviewText(makeItem({ text: { es: 'Hola', en: 'Hello', pt: 'Olá' } }));
        expect(out).toBe('Hola');
    });

    it('falls back through en -> pt when es is empty', () => {
        const out = pickPreviewText(makeItem({ text: { es: '', en: 'Hello', pt: 'Olá' } }));
        expect(out).toBe('Hello');
    });

    it('truncates very long previews with an ellipsis', () => {
        const long = 'x'.repeat(120);
        const out = pickPreviewText(makeItem({ text: { es: long, en: 'en', pt: 'pt' } }));
        expect(out.length).toBeLessThanOrEqual(80);
        expect(out.endsWith('…')).toBe(true);
    });

    it('returns an empty string when every locale is blank', () => {
        const out = pickPreviewText(makeItem({ text: { es: '', en: '', pt: '' } }));
        expect(out).toBe('');
    });
});
