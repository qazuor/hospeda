import type { ListingNotice } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { TranslationFn } from '@/lib/i18n';
import { buildBusinessLinesChangedView } from '@/lib/listing/business-lines-notice-view';
import type { CopyContext } from '@/lib/listing/listing-notices';

/** The copy keys the builder reads, with the labels it is handed as data. */
const COPY: Readonly<Record<string, string>> = {
    'listing.notices.businessLinesChanged.title': 'Soporte cambió los rubros de esta ficha',
    'listing.notices.businessLinesChanged.added': 'Agregó: {{lines}}.',
    'listing.notices.businessLinesChanged.removed': 'Quitó: {{lines}}.',
    'listing.notices.businessLinesChanged.shownSections': 'Ahora se ven: {{sections}}.',
    'listing.notices.businessLinesChanged.hiddenSections': 'Dejan de verse: {{sections}}.',
    'listing.notices.businessLinesChanged.nothingDeleted':
        'No se borró nada: lo que cargaste en una sección oculta vuelve si recuperás el rubro.',
    'listing.notices.businessLinesChanged.changedAt': 'Cambio del {{date}}.',
    'venue.owner.businessLines.nightlife.label': 'Noche',
    'listing.owner.editor.sectionNav.nightInfo': 'Info para salir'
};

/** A fake `t`: reads the copy above and interpolates `{{name}}` params. */
const t: TranslationFn = (key, fallback, params) => {
    const template = COPY[key] ?? fallback ?? key;
    return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(params?.[name] ?? `{{${name}}}`)
    );
};

const ctx: CopyContext = {
    locale: 'es',
    t,
    tPlural: (key, count) => `${key}:${count}`,
    recurringListingAddons: 0
};

function notice(
    overrides: Partial<Extract<ListingNotice, { kind: 'BUSINESS_LINES_CHANGED' }>> = {}
): Extract<ListingNotice, { kind: 'BUSINESS_LINES_CHANGED' }> {
    return {
        kind: 'BUSINESS_LINES_CHANGED',
        at: '2026-10-10T12:00:00.000Z',
        addedLines: ['nightlife'],
        removedLines: [],
        shownSections: ['nightInfo'],
        hiddenSections: [],
        ...overrides
    };
}

function textOf(lines: readonly string[]): string {
    return [...lines].join('\n');
}

describe('TEST:7.3:11 buildBusinessLinesChangedView (HOS-1875)', () => {
    it('titles the notice and names the added line and the section it makes visible', () => {
        // Act
        const view = buildBusinessLinesChangedView({ notice: notice(), ctx });

        // Assert
        expect(view?.title).toBe('Soporte cambió los rubros de esta ficha');
        expect(view?.tone).toBe('info');
        expect(view?.reportFixed).toBeNull();
        expect(textOf(view?.lines ?? [])).toContain('Agregó: Noche.');
        expect(textOf(view?.lines ?? [])).toContain('Ahora se ven: Info para salir.');
        expect(textOf(view?.lines ?? [])).toContain('Cambio del 10 de octubre de 2026.');
    });

    it('leaves out every line that does not apply', () => {
        // Act
        const text = textOf(buildBusinessLinesChangedView({ notice: notice(), ctx })?.lines ?? []);

        // Assert
        expect(text).not.toContain('Quitó:');
        expect(text).not.toContain('Dejan de verse:');
        expect(text).not.toContain('No se borró nada');
    });

    it('says what stops being visible and that nothing was deleted when a line is removed', () => {
        // Act
        const text = textOf(
            buildBusinessLinesChangedView({
                notice: notice({
                    addedLines: [],
                    removedLines: ['nightlife'],
                    shownSections: [],
                    hiddenSections: ['nightInfo']
                }),
                ctx
            })?.lines ?? []
        );

        // Assert
        expect(text).toContain('Quitó: Noche.');
        expect(text).toContain('Dejan de verse: Info para salir.');
        expect(text).toContain(
            'No se borró nada: lo que cargaste en una sección oculta vuelve si recuperás el rubro.'
        );
        expect(text).not.toContain('Agregó:');
        expect(text).not.toContain('Ahora se ven:');
    });
});
