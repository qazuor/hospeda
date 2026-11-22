/**
 * HOS-2410 web-ui §3 and §8 (AC-6, AC-7, AC-8) — the help search island,
 * over the real index projection. It must never touch the network.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    HelpSearch,
    helpSearchAnnouncement
} from '../../../../src/components/account/help/HelpSearch.client';
import { HELP_AUDIENCE_CHANGED_EVENT } from '../../../../src/lib/help/help-audience';
import { announceReaderWithoutAudience } from '../../../../src/lib/help/help-audience-shared';
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
        const message = screen
            .getAllByText('No encontramos ayuda para eso')
            .find((element) => !element.hasAttribute('aria-live'));
        const box = message?.parentElement as HTMLElement;
        expect(
            within(box)
                .getAllByRole('link')
                .map((link) => link.getAttribute('href'))
        ).toEqual(['/es/preguntas-frecuentes/', '/es/contacto/']);
        expect(resultIds()).toEqual([]);
    });

    it('announces the no-match sentence in the live region, not silence (HOS-2552)', () => {
        // Arrange
        const { container } = renderSearch();

        // Act
        type('zzqx yyqw');

        // Assert
        const live = container.querySelector('[aria-live="polite"]');
        expect(live?.textContent).toBe('No encontramos ayuda para eso');
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('has a «Buscar» button and the same placeholder as the article search (HOS-2552)', () => {
        // Arrange
        renderSearch();
        type('fotos');

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

        // Assert
        expect(screen.getByLabelText('Buscar en la ayuda')).toHaveAttribute(
            'placeholder',
            'Por ejemplo: cómo subo fotos'
        );
        expect(document.activeElement?.getAttribute('href')).toMatch(/^\/es\/mi-cuenta\/ayuda\//);
    });

    it('carries the filtered audience into the result links (HOS-2552)', () => {
        // Arrange
        renderSearch('host');

        // Act
        type('fotos');

        // Assert
        const photos = screen
            .getAllByRole('link')
            .find((link) => link.getAttribute('href')?.startsWith('/es/mi-cuenta/ayuda/photos/'));
        expect(photos?.getAttribute('href')).toBe('/es/mi-cuenta/ayuda/photos/?para=host');
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

    it('announces nothing below two characters', () => {
        const { container } = renderSearch();
        type('f');
        expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('');
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

    it('starts on the tab the page already shows, whatever the hydration order', () => {
        // Arrange: the tabs switched to provider before this island hydrated,
        // so no change event will reach it
        document.body.innerHTML = '<div data-help-tabs data-selected="provider"></div>';

        // Act
        renderSearch('host');
        type('fotos');

        // Assert
        expect(resultIds()).not.toContain('photos');
        document.querySelector('[data-help-tabs]')?.remove();
    });

    it('reads a valid ?para= when there are no tabs on the page', () => {
        // Arrange
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/?para=provider');

        // Act
        renderSearch('host');
        type('fotos');

        // Assert
        expect(resultIds()).not.toContain('photos');
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/');
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

describe('HelpSearch (HOS-2552 review)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    const props = (initialQuery: string) => ({
        locale: 'es' as const,
        articles,
        initialAudience: 'host' as const,
        initialQuery,
        articlePaths,
        faqPath: '/es/preguntas-frecuentes/',
        contactPath: '/es/contacto/'
    });

    it('server-renders an empty live region, so an initial ?q= is announced after hydration', () => {
        // Act
        const html = renderToString(<HelpSearch {...props('zzqx yyqw')} />);

        // Assert
        expect(html).toMatch(/<p class="sr-only" aria-live="polite"[^>]*><\/p>/);
    });

    it('announces the initial ?q= no-match once hydrated', () => {
        const { container } = render(<HelpSearch {...props('zzqx yyqw')} />);
        expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
            'No encontramos ayuda para eso'
        );
    });

    it('sends the selected tab with a no-JS GET', () => {
        const { container } = render(<HelpSearch {...props('')} />);
        expect(container.querySelector('input[type="hidden"][name="para"]')).toHaveValue('host');
    });

    it('«Buscar» with no result returns focus to the input and repeats the announcement', () => {
        // Arrange
        const { container } = render(<HelpSearch {...props('zzqx yyqw')} />);
        const live = container.querySelector('[aria-live="polite"]');
        const before = live?.textContent;

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

        // Assert
        expect(document.activeElement).toBe(screen.getByLabelText('Buscar en la ayuda'));
        expect(live?.textContent).not.toBe(before);
        expect(live?.textContent?.trim()).toBe('No encontramos ayuda para eso');
    });

    it('«Buscar» below two characters focuses the input', () => {
        render(<HelpSearch {...props('f')} />);
        fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
        expect(document.activeElement).toBe(screen.getByLabelText('Buscar en la ayuda'));
    });

    it('carries the selected tab in result links with the filter off too', () => {
        // Arrange
        render(<HelpSearch {...props('fotos')} />);

        // Act
        fireEvent.click(screen.getByLabelText('Solo para mi tipo de cuenta'));

        // Assert
        const photos = screen
            .getAllByRole('link')
            .find((link) => link.getAttribute('href')?.startsWith('/es/mi-cuenta/ayuda/photos/'));
        expect(photos?.getAttribute('href')).toBe('/es/mi-cuenta/ayuda/photos/?para=host');
    });
});

describe('HelpSearch for a reader with no business audience (tourist)', () => {
    afterEach(() => {
        document.documentElement.removeAttribute('data-help-reader-without-audience');
    });

    it('baseline: the default host tab finds the client-only AI assistants article', () => {
        renderSearch('host');
        type('conectar asistente');
        expect(resultIds()).toContain('ai-assistants');
    });

    it('shows no article «for my account type», only the FAQ and contact fallback', () => {
        // Arrange
        renderSearch('host');

        // Act
        act(() => announceReaderWithoutAudience());
        type('conectar asistente');

        // Assert
        expect(resultIds()).not.toContain('ai-assistants');
        expect(resultIds()).toHaveLength(0);
        expect(screen.getByRole('link', { name: /preguntas frecuentes/i })).toBeInTheDocument();
    });

    it('reads the fact when the preselection ran before hydration', () => {
        announceReaderWithoutAudience();
        renderSearch('host');
        type('conectar asistente');
        expect(resultIds()).toHaveLength(0);
    });

    it('shows every article again with the toggle off', () => {
        // Arrange
        announceReaderWithoutAudience();
        renderSearch('host');

        // Act
        fireEvent.click(screen.getByRole('checkbox', { name: 'Solo para mi tipo de cuenta' }));
        type('conectar asistente');

        // Assert
        expect(resultIds()).toContain('ai-assistants');
    });
});

describe('helpSearchAnnouncement', () => {
    const countText = (count: number) => `${count} resultados`;

    it('is empty before a searchable query', () => {
        expect(
            helpSearchAnnouncement({ searched: false, count: 0, countText, noMatchText: 'nada' })
        ).toBe('');
    });

    it('announces the count when there are results', () => {
        expect(
            helpSearchAnnouncement({ searched: true, count: 3, countText, noMatchText: 'nada' })
        ).toBe('3 resultados');
    });

    it('announces the no-match sentence on zero results', () => {
        expect(
            helpSearchAnnouncement({ searched: true, count: 0, countText, noMatchText: 'nada' })
        ).toBe('nada');
    });
});
