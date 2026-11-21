/**
 * HOS-2410 web-ui §3 and §8 (AC-6, AC-7, AC-8) — the help search island,
 * over the real index projection. It must never touch the network.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpSearch } from '../../../../src/components/account/help/HelpSearch.client';
import { HELP_AUDIENCE_CHANGED_EVENT } from '../../../../src/lib/help/help-audience';
import {
    listLocalizedHelpArticles,
    toHelpSearchEntries
} from '../../../../src/lib/help/help-catalog';

const articles = toHelpSearchEntries({ articles: listLocalizedHelpArticles({ locale: 'es' }) });
const articlePaths = Object.fromEntries(
    articles.map((entry) => [entry.id, `/es/mi-cuenta/ayuda/${entry.id}/`])
);

function renderSearch(initialAudience: 'host' | 'venue' | 'partner' = 'host') {
    return render(
        <HelpSearch
            locale="es"
            articles={articles}
            initialAudience={initialAudience}
            articlePaths={articlePaths}
            faqPath="/es/preguntas-frecuentes/"
            contactPath="/es/contacto/"
        />
    );
}

const type = (value: string) =>
    fireEvent.change(screen.getByLabelText('Buscar en la ayuda'), { target: { value } });

const resultIds = () =>
    screen
        .queryAllByRole('link')
        .map((link) => link.getAttribute('href') ?? '')
        .filter((href) => href.startsWith('/es/mi-cuenta/ayuda/'))
        .map((href) => href.split('/').at(-2));

describe('HelpSearch', () => {
    const fetchSpy = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        fetchSpy.mockReset();
    });

    it('ranks photos first for "cómo subo fotos" without any network request (AC-6)', () => {
        // Arrange
        renderSearch();

        // Act
        type('cómo subo fotos');

        // Assert
        expect(resultIds()[0]).toBe('photos');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('gives the same results for accents and capitals (AC-7)', () => {
        // Arrange
        renderSearch();
        type('fotografias');
        const plain = resultIds();

        // Act
        type('FOTOGRAFÍAS');

        // Assert
        expect(resultIds()).toEqual(plain);
        expect(plain.length).toBeGreaterThan(0);
    });

    it('shows the no-match message with FAQ and contact links only (AC-8)', () => {
        // Arrange
        renderSearch();

        // Act
        type('zzqx yyqw');

        // Assert
        const status = screen.getByRole('status');
        expect(within(status).getByText('No encontramos ayuda para eso')).toBeInTheDocument();
        expect(
            within(status)
                .getAllByRole('link')
                .map((link) => link.getAttribute('href'))
        ).toEqual(['/es/preguntas-frecuentes/', '/es/contacto/']);
        expect(resultIds()).toEqual([]);
    });

    it('shows nothing below two characters', () => {
        renderSearch();
        type('f');
        expect(resultIds()).toEqual([]);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('announces the result count in a polite live region', () => {
        // Arrange
        const { container } = renderSearch();

        // Act
        type('fotos');

        // Assert
        const live = container.querySelector('[aria-live="polite"]');
        expect(live?.textContent).toMatch(/^\d+ resultados?$/);
    });

    it('clears on Escape', () => {
        // Arrange
        renderSearch();
        type('fotos');

        // Act
        fireEvent.keyDown(screen.getByLabelText('Buscar en la ayuda'), { key: 'Escape' });

        // Assert
        expect(screen.getByLabelText('Buscar en la ayuda')).toHaveValue('');
        expect(resultIds()).toEqual([]);
    });

    it('filters by the selected tab audience while "only my account type" is on', () => {
        // Arrange: no partner article mentions photos before Phase 5
        renderSearch('host');
        type('fotos');
        expect(resultIds().length).toBeGreaterThan(0);

        // Act
        act(() => {
            window.dispatchEvent(
                new CustomEvent(HELP_AUDIENCE_CHANGED_EVENT, { detail: { audience: 'provider' } })
            );
        });
        const providerOnly = resultIds();
        fireEvent.click(screen.getByLabelText('Solo para mi tipo de cuenta'));

        // Assert
        expect(providerOnly).not.toContain('photos');
        expect(resultIds()).toContain('photos');
    });

    it('searches the initial ?q= on the first render (SSR-first)', () => {
        render(
            <HelpSearch
                locale="es"
                articles={articles}
                initialAudience="host"
                initialQuery="fotos"
                articlePaths={articlePaths}
                faqPath="/es/preguntas-frecuentes/"
                contactPath="/es/contacto/"
            />
        );
        expect(resultIds()).toContain('photos');
    });
});
