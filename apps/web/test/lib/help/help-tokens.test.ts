/**
 * HOS-2410 data-model §5.2 (web row) — server-side token resolution.
 */

import { describe, expect, it } from 'vitest';
import {
    helpArticlePath,
    helpDestinationPath,
    resolveHelpTokensForWeb
} from '../../../src/lib/help/help-tokens';

const base = {
    article: { verticals: ['venue' as const] },
    locale: 'es' as const,
    neutralLimitText: 'el tope de tu plan',
    titleOf: (id: string) => (id === 'photos' ? 'Subir fotos' : undefined)
};

describe('resolveHelpTokensForWeb', () => {
    it('renders a limit token as a neutral span carrying the key and the default vertical', () => {
        // Act
        const html = resolveHelpTokensForWeb({
            ...base,
            text: 'Hasta {{limit:max_photos_per_venue}}.'
        });

        // Assert
        expect(html).toBe(
            'Hasta <span data-help-limit="max_photos_per_venue" data-vertical="venue">el tope de tu plan</span>.'
        );
    });

    it('uses an explicit limit vertical over the article default', () => {
        const html = resolveHelpTokensForWeb({
            ...base,
            text: '{{limit:max_photos_per_accommodation:accommodation}}'
        });
        expect(html).toContain('data-vertical="accommodation"');
    });

    it('renders a link token as a relative portal link with its label', () => {
        const html = resolveHelpTokensForWeb({
            ...base,
            text: '{{link:plans:venue|ver los planes}}'
        });
        expect(html).toMatch(/^<a href="\/es\/[^"]+\/">ver los planes<\/a>$/);
        expect(html).not.toContain('http');
    });

    it('points an editor section link at the vertical list page (no listing id on the server)', () => {
        // Act
        const html = resolveHelpTokensForWeb({
            ...base,
            text: '{{link:section:accommodation:calendario|Calendario}}'
        });

        // Assert
        expect(html).toBe(
            `<a href="${helpDestinationPath({ destination: { kind: 'ownerListings', vertical: 'accommodation' }, locale: 'es' })}">Calendario</a>`
        );
        expect(html).not.toContain('[id]');
    });

    it('falls back to the default destination label when the link has none', () => {
        const html = resolveHelpTokensForWeb({ ...base, text: '{{link:faq}}' });
        expect(html).toBe('<a href="/es/preguntas-frecuentes/">Ver las preguntas frecuentes</a>');
    });

    it('links an article token to the article and section, titled when unlabelled', () => {
        expect(
            resolveHelpTokensForWeb({ ...base, text: '{{article:photos:problemas-comunes}}' })
        ).toBe('<a href="/es/mi-cuenta/ayuda/photos/#problemas-comunes">Subir fotos</a>');
    });

    it('escapes labels', () => {
        const html = resolveHelpTokensForWeb({ ...base, text: '{{article:photos|a <b> & "c"}}' });
        expect(html).toContain('a &lt;b&gt; &amp; &quot;c&quot;');
    });
});

describe('helpArticlePath', () => {
    it('builds the locale-prefixed article path', () => {
        expect(helpArticlePath({ id: 'photos', locale: 'pt' })).toBe('/pt/mi-cuenta/ayuda/photos/');
    });
});
