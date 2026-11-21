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
    input: Pick<EmailPreviewEntrySummary, 'key' | 'id' | 'name' | 'domain'>
): EmailPreviewEntrySummary => ({
    ...input,
    sendPath: 'outbox',
    wired: true,
    scenarios: [{ id: 'default', label: 'Por defecto' }]
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
        expect(filterEmailCatalog({ entries: ENTRIES, search: 'renov', domains: [] })).toEqual([
            ENTRIES[0]
        ]);
        expect(filterEmailCatalog({ entries: ENTRIES, search: 'AUTH.RESET', domains: [] })).toEqual(
            [ENTRIES[1]]
        );
        expect(filterEmailCatalog({ entries: ENTRIES, search: '  ', domains: [] })).toEqual(
            ENTRIES
        );
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
            domains: []
        });

        // Assert
        expect(result).toEqual([idOnly]);
    });

    it('combines the search with a multi-domain filter', () => {
        expect(
            filterEmailCatalog({ entries: ENTRIES, search: '', domains: ['auth', 'billing'] })
        ).toEqual(ENTRIES);
        expect(filterEmailCatalog({ entries: ENTRIES, search: 'pago', domains: ['auth'] })).toEqual(
            []
        );
    });

    it('groups by domain and lists domains in catalog order', () => {
        expect(groupEmailCatalogByDomain({ entries: ENTRIES })).toEqual([
            { domain: 'billing', entries: [ENTRIES[0], ENTRIES[2]] },
            { domain: 'auth', entries: [ENTRIES[1]] }
        ]);
        expect(listCatalogDomains({ entries: ENTRIES })).toEqual(['billing', 'auth']);
    });
});
