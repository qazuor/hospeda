/**
 * @file ai-activity.test.ts
 * @description Pure helpers of the assistant history (HOS-2348, spec HOS-2335
 * §6.9): the reads toggle mapping (D-12), the response parser, the `send` /
 * `commit` equivalence, the result labels and the lost-target rule (AC-C47).
 */

import { describe, expect, it } from 'vitest';
import {
    buildAiActivityUrl,
    normalizeAiActivityStep,
    parseAiActivityPage,
    resolveAiActivityResult,
    resolveAiActivityTarget
} from '../../src/lib/ai-activity';

const API = 'http://localhost:3001';
const ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

describe('buildAiActivityUrl (D-12 toggle)', () => {
    it('sends no includeReads when the toggle is off: writes only', () => {
        const url = new URL(
            buildAiActivityUrl({ apiUrl: `${API}/`, page: 1, includeReads: false })
        );

        expect(url.pathname).toBe('/api/v1/protected/ai-connections/activity');
        expect(url.searchParams.has('includeReads')).toBe(false);
        expect(url.searchParams.get('page')).toBe('1');
    });

    it('sends includeReads=true when the toggle is on', () => {
        const url = new URL(buildAiActivityUrl({ apiUrl: API, page: 3, includeReads: true }));

        expect(url.searchParams.get('includeReads')).toBe('true');
        expect(url.searchParams.get('page')).toBe('3');
    });

    it('adds the result filter and never a user', () => {
        const url = new URL(
            buildAiActivityUrl({ apiUrl: API, page: 1, includeReads: false, outcome: 'denied' })
        );

        expect(url.searchParams.get('outcome')).toBe('denied');
        expect([...url.searchParams.keys()].sort()).toEqual(['outcome', 'page']);
    });
});

describe('parseAiActivityPage', () => {
    const item = {
        id: ID,
        loggedAt: '2026-11-18T10:00:00.000Z',
        tool: 'reply_inquiry',
        isWrite: true,
        outcome: 'success',
        client: { id: 'client-1' }
    };

    it('reads the items and the page, with loggedAt as a date', () => {
        const parsed = parseAiActivityPage({
            body: {
                success: true,
                data: { items: [item], pagination: { page: 2, totalPages: 4, total: 70 } }
            }
        });

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.page).toBe(2);
        expect(parsed.totalPages).toBe(4);
        expect(parsed.items[0]?.loggedAt.toISOString()).toBe('2026-11-18T10:00:00.000Z');
    });

    it('drops a key the web does not know instead of failing', () => {
        const parsed = parseAiActivityPage({
            body: {
                success: true,
                data: {
                    items: [{ ...item, futureField: 'x' }],
                    pagination: { page: 1, totalPages: 1, total: 1 }
                }
            }
        });

        expect(parsed.ok && Object.keys(parsed.items[0] ?? {})).not.toContain('futureField');
    });

    it.each([
        null,
        { success: false },
        { success: true, data: { items: 'nope' } },
        { success: true, data: { items: [], pagination: {} } }
    ])('refuses an unexpected envelope (%#)', (body) => {
        expect(parseAiActivityPage({ body }).ok).toBe(false);
    });
});

describe('normalizeAiActivityStep', () => {
    it('reads the old send and the new commit as the same confirmed step', () => {
        expect(normalizeAiActivityStep({ step: 'send' })).toBe('commit');
        expect(normalizeAiActivityStep({ step: 'commit' })).toBe('commit');
        expect(normalizeAiActivityStep({ step: 'send' })).toBe(
            normalizeAiActivityStep({ step: 'commit' })
        );
    });

    it('keeps preview, and hides anything else', () => {
        expect(normalizeAiActivityStep({ step: 'preview' })).toBe('preview');
        expect(normalizeAiActivityStep({ step: 'declined' })).toBeUndefined();
        expect(normalizeAiActivityStep({})).toBeUndefined();
    });
});

describe('resolveAiActivityResult', () => {
    it.each([
        ['success', undefined, 'done'],
        ['error', 'INTERNAL_ERROR', 'error'],
        ['denied', 'FORBIDDEN', 'deniedByHospeda'],
        ['denied', undefined, 'deniedByHospeda'],
        ['denied', 'USER_DECLINED', 'declinedByYou'],
        ['denied', 'USER_CANCELLED', 'declinedByYou']
    ] as const)('%s with %s is %s', (outcome, errorCode, expected) => {
        expect(resolveAiActivityResult({ outcome, errorCode })).toBe(expected);
    });
});

describe('resolveAiActivityTarget (AC-C47)', () => {
    it('shows an owned listing with its name and link', () => {
        expect(
            resolveAiActivityTarget({
                target: {
                    type: 'accommodation',
                    id: ID,
                    label: 'Casa del Río',
                    url: 'https://hospeda.test/es/mi-cuenta/propiedades/x/editar/'
                }
            })
        ).toEqual({
            kind: 'listing',
            label: 'Casa del Río',
            url: 'https://hospeda.test/es/mi-cuenta/propiedades/x/editar/'
        });
    });

    it('shows a listing the user lost with no name and no link', () => {
        expect(
            resolveAiActivityTarget({
                target: { type: 'venue', id: ID, url: 'https://hospeda.test/x/' }
            })
        ).toEqual({ kind: 'listingUnavailable' });
    });

    it('reads a conversation as "Consulta", linked only when the API gave a link', () => {
        expect(resolveAiActivityTarget({ target: { type: 'conversation', id: ID } })).toEqual({
            kind: 'conversation'
        });
        expect(
            resolveAiActivityTarget({
                target: { type: 'conversation', id: ID, url: 'https://hospeda.test/c/' }
            })
        ).toEqual({ kind: 'conversation', url: 'https://hospeda.test/c/' });
    });

    it('drops a link that is not http(s)', () => {
        expect(
            resolveAiActivityTarget({
                target: { type: 'experience', id: ID, label: 'Kayak', url: 'javascript:alert(1)' }
            })
        ).toEqual({ kind: 'listing', label: 'Kayak' });
    });

    it('shows nothing for a target type it does not know', () => {
        expect(resolveAiActivityTarget({ target: { type: 'amenity', id: ID } })).toBeUndefined();
        expect(resolveAiActivityTarget({})).toBeUndefined();
    });
});
