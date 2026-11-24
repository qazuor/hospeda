/**
 * HOS-2519 §8: pure search, filter and grouping of the email catalog.
 */

import type { EmailPreviewEntrySummary } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    filterEmailCatalog,
    groupEmailCatalogByDomain,
    listCatalogDomains,
    normalizeSearchText
} from '../../../../src/routes/_authed/platform/emails/-components/email-catalog-filter';

const entry = (
    input: Pick<EmailPreviewEntrySummary, 'key' | 'id' | 'name' | 'domain'> &
        Partial<Pick<EmailPreviewEntrySummary, 'audience' | 'scenarios'>>
): EmailPreviewEntrySummary => ({
    audience: 'user',
    scenarios: [{ id: 'default', label: 'Por defecto', locale: 'es', subject: null }],
    ...input,
    sendPath: 'outbox',
    wired: true
});

const ENTRIES = [
    entry({ key: 'outbox.a', id: 'a', name: 'Renovación anual', domain: 'billing' }),
    entry({ key: 'auth.reset', id: 'reset', name: 'Contraseña', domain: 'auth' }),
    entry({ key: 'outbox.b', id: 'b', name: 'Pago rechazado', domain: 'billing' })
];

describe('email catalog filter', () => {
    it('normalizes case and diacritics', () => {
        expect(normalizeSearchText({ text: '  RenovACIÓN ' })).toBe('renovacion');
    });

    it('matches name, key or id, and returns everything for a blank search', () => {
        expect(
            filterEmailCatalog({ entries: ENTRIES, search: 'renov', domains: [], audience: 'all' })
        ).toEqual([ENTRIES[0]]);
        expect(
            filterEmailCatalog({
                entries: ENTRIES,
                search: 'AUTH.RESET',
                domains: [],
                audience: 'all'
            })
        ).toEqual([ENTRIES[1]]);
        expect(
            filterEmailCatalog({ entries: ENTRIES, search: '  ', domains: [], audience: 'all' })
        ).toEqual(ENTRIES);
    });

    it('matches on the id alone when neither the name nor the key contain it', () => {
        // Arrange: an id that is not a substring of its key or its name
        const idOnly = entry({
            key: 'notification.trial_ending_2d',
            id: 'zeta-template-id',
            name: 'Fin de prueba',
            domain: 'trial'
        });

        // Act
        const result = filterEmailCatalog({
            entries: [...ENTRIES, idOnly],
            search: 'ZETA-template',
            domains: [],
            audience: 'all'
        });

        // Assert
        expect(result).toEqual([idOnly]);
    });

    it('HOS-2580 §H matches a scenario subject, accent- and case-insensitively', () => {
        // Arrange: the subject shares no word with the name (the owner's search).
        const downgrade = entry({
            key: 'outbox.billing.downgrade-limit',
            id: 'billing.downgrade-limit',
            name: 'Aviso de límite por cambio a un plan menor',
            domain: 'billing',
            scenarios: [
                { id: 'one', label: 'Uno', locale: 'es', subject: 'Otro asunto' },
                {
                    id: 'two',
                    label: 'Dos',
                    locale: 'es',
                    subject: 'Cambio de límite en tu plan'
                },
                { id: 'broken', label: 'Roto', locale: 'es', subject: null }
            ]
        });
        const entries = [...ENTRIES, downgrade];

        // Act
        const exact = filterEmailCatalog({
            entries,
            search: 'Cambio de límite en tu plan',
            domains: [],
            audience: 'all'
        });
        const loose = filterEmailCatalog({
            entries,
            search: 'CAMBIO DE LIMITE EN TU',
            domains: [],
            audience: 'all'
        });
        const miss = filterEmailCatalog({
            entries,
            search: 'asunto inexistente',
            domains: [],
            audience: 'all'
        });

        // Assert
        expect(exact).toEqual([downgrade]);
        expect(loose).toEqual([downgrade]);
        expect(miss).toEqual([]);
    });

    it('combines the search with a multi-domain filter', () => {
        expect(
            filterEmailCatalog({
                entries: ENTRIES,
                search: '',
                domains: ['auth', 'billing'],
                audience: 'all'
            })
        ).toEqual(ENTRIES);
        expect(
            filterEmailCatalog({
                entries: ENTRIES,
                search: 'pago',
                domains: ['auth'],
                audience: 'all'
            })
        ).toEqual([]);
    });

    it('filters by audience and combines it with search and domains', () => {
        // Arrange
        const staff = entry({
            key: 'outbox.billing.reconciliation-summary',
            id: 'billing.reconciliation-summary',
            name: 'Resumen de conciliación',
            domain: 'billing',
            audience: 'staff'
        });
        const entries = [...ENTRIES, staff];

        // Act + Assert
        expect(filterEmailCatalog({ entries, search: '', domains: [], audience: 'staff' })).toEqual(
            [staff]
        );
        expect(filterEmailCatalog({ entries, search: '', domains: [], audience: 'user' })).toEqual(
            ENTRIES
        );
        expect(filterEmailCatalog({ entries, search: '', domains: [], audience: 'all' })).toEqual(
            entries
        );
        expect(
            filterEmailCatalog({ entries, search: 'conciliacion', domains: [], audience: 'staff' })
        ).toEqual([staff]);
        expect(
            filterEmailCatalog({ entries, search: 'renov', domains: [], audience: 'staff' })
        ).toEqual([]);
        expect(
            filterEmailCatalog({ entries, search: '', domains: ['auth'], audience: 'staff' })
        ).toEqual([]);
    });

    it('groups by domain and lists domains in catalog order', () => {
        expect(groupEmailCatalogByDomain({ entries: ENTRIES })).toEqual([
            { domain: 'billing', entries: [ENTRIES[0], ENTRIES[2]] },
            { domain: 'auth', entries: [ENTRIES[1]] }
        ]);
        expect(listCatalogDomains({ entries: ENTRIES })).toEqual(['billing', 'auth']);
    });
});
