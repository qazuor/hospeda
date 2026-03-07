/**
 * @file search-bar.test.tsx
 * @description Tests for SearchBar.client.tsx component.
 *
 * Covers rendering, locale-specific placeholders, input interaction,
 * clear button visibility, search submission via Enter key and button click,
 * onSearch callback vs URL navigation, debounce behavior,
 * button disabled state, and accessibility.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from '../../../src/components/search/SearchBar.client';

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: ({ namespace }: { namespace: string }) => ({
        t: (key: string, fallback?: string) => {
            // Return locale-aware fallbacks for known keys used in tests
            if (namespace === 'ui' && key === 'accessibility.search') return 'Search';
            if (namespace === 'ui' && key === 'accessibility.clearSearch') return 'Clear search';
            return fallback ?? key;
        },
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@repo/icons', () => ({
    SearchIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="search"
        />
    ),
    CloseIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="close"
        />
    )
}));

// Provide real i18n translations for the search namespace placeholder
vi.mock('../../../src/lib/i18n', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/i18n')>();
    return actual;
});

describe('SearchBar.client.tsx', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { href: '' }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe('Props', () => {
        it('should render search input with default Spanish locale', () => {
            render(<SearchBar />);
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('should use custom placeholder when provided, overriding locale default', () => {
            render(<SearchBar placeholder="Find your stay" />);
            expect(screen.getByPlaceholderText('Find your stay')).toBeInTheDocument();
        });

        it('should populate input with defaultValue when provided', () => {
            render(
                <SearchBar
                    locale="en"
                    defaultValue="beach resort"
                />
            );
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toBe('beach resort');
        });

        it('should accept onSearch callback without calling it on mount', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="en"
                    onSearch={handleSearch}
                />
            );
            expect(handleSearch).not.toHaveBeenCalled();
        });

        it('should apply className prop to the wrapper element', () => {
            const { container } = render(
                <SearchBar
                    locale="en"
                    className="my-search-bar"
                />
            );
            expect(container.firstChild).toHaveClass('my-search-bar');
        });
    });

    describe('Rendering', () => {
        it('should render the text input', () => {
            render(<SearchBar locale="en" />);
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('should not show the clear button when the input is empty', () => {
            render(<SearchBar locale="en" />);
            expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
        });

        it('should show the clear button when defaultValue is set', () => {
            render(
                <SearchBar
                    locale="en"
                    defaultValue="test"
                />
            );
            expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
        });

        it('should render the search submit button', () => {
            render(<SearchBar locale="en" />);
            const searchElements = screen.getAllByLabelText('Search');
            // Both the input and the submit button share aria-label="Search"
            const submitButton = searchElements.find((el) => el.tagName === 'BUTTON');
            expect(submitButton).toBeInTheDocument();
        });
    });

    describe('Input interaction', () => {
        it('should update input value as user types', () => {
            render(<SearchBar locale="en" />);
            const input = screen.getByRole('textbox') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'hotel' } });
            expect(input.value).toBe('hotel');
        });

        it('should show clear button after typing', () => {
            render(<SearchBar locale="en" />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'resort' } });
            expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
        });

        it('should clear input when clear button is clicked', () => {
            render(
                <SearchBar
                    locale="en"
                    defaultValue="playa"
                />
            );
            const input = screen.getByRole('textbox') as HTMLInputElement;
            fireEvent.click(screen.getByLabelText('Clear search'));
            expect(input.value).toBe('');
        });

        it('should hide clear button after clearing input', () => {
            render(
                <SearchBar
                    locale="en"
                    defaultValue="playa"
                />
            );
            fireEvent.click(screen.getByLabelText('Clear search'));
            expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
        });
    });

    describe('Search functionality with onSearch callback', () => {
        it('should call onSearch with trimmed query on Enter key', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="en"
                    onSearch={handleSearch}
                />
            );
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'mountain lodge' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
            expect(handleSearch).toHaveBeenCalledWith('mountain lodge');
            expect(handleSearch).toHaveBeenCalledTimes(1);
        });

        it('should call onSearch when the search button is clicked', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="en"
                    onSearch={handleSearch}
                />
            );
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cabana' } });
            const submitButton = screen
                .getAllByLabelText('Search')
                .find((el) => el.tagName === 'BUTTON');
            if (!submitButton) throw new Error('Submit button not found');
            fireEvent.click(submitButton);
            expect(handleSearch).toHaveBeenCalledWith('cabana');
        });

        it('should not call onSearch when input is empty', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="en"
                    onSearch={handleSearch}
                />
            );
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(handleSearch).not.toHaveBeenCalled();
        });

        it('should not call onSearch when input contains only whitespace', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="en"
                    onSearch={handleSearch}
                />
            );
            fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(handleSearch).not.toHaveBeenCalled();
        });

        it('should trim query before passing to onSearch', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="en"
                    onSearch={handleSearch}
                />
            );
            fireEvent.change(screen.getByRole('textbox'), { target: { value: '  hotel  ' } });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(handleSearch).toHaveBeenCalledWith('hotel');
        });
    });

    describe('Navigation (no onSearch callback)', () => {
        it('should navigate to /es/busqueda/ on Enter for Spanish locale', () => {
            render(<SearchBar locale="es" />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'playa' } });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(window.location.href).toBe('/es/busqueda/?q=playa');
        });

        it('should navigate to /en/busqueda/ on Enter for English locale', () => {
            render(<SearchBar locale="en" />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'beach' } });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(window.location.href).toBe('/en/busqueda/?q=beach');
        });

        it('should encode special characters in the query parameter', () => {
            render(<SearchBar locale="es" />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hotel & spa' } });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(window.location.href).toBe('/es/busqueda/?q=hotel%20%26%20spa');
        });

        it('should not navigate when onSearch callback is provided', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="es"
                    onSearch={handleSearch}
                />
            );
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(handleSearch).toHaveBeenCalledWith('test');
            expect(window.location.href).toBe('');
        });
    });

    describe('Debounce behavior', () => {
        it('should update displayed input value immediately without waiting for debounce', () => {
            render(<SearchBar locale="en" />);
            const input = screen.getByRole('textbox') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'h' } });
            expect(input.value).toBe('h');
            fireEvent.change(input, { target: { value: 'ho' } });
            expect(input.value).toBe('ho');
        });

        it('should clear debounce timeout on unmount without errors', () => {
            vi.useFakeTimers();
            const { unmount } = render(<SearchBar locale="en" />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
            unmount();
            vi.advanceTimersByTime(300);
            // No error thrown = pass
        });
    });

    describe('Button disabled state', () => {
        it('should disable search button when input is empty', () => {
            render(<SearchBar locale="en" />);
            const submitButton = screen
                .getAllByLabelText('Search')
                .find((el) => el.tagName === 'BUTTON');
            expect(submitButton).toBeDisabled();
        });

        it('should enable search button when input has text', () => {
            render(<SearchBar locale="en" />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'resort' } });
            const submitButton = screen
                .getAllByLabelText('Search')
                .find((el) => el.tagName === 'BUTTON');
            expect(submitButton).not.toBeDisabled();
        });

        it('should disable search button again after clearing input', () => {
            render(
                <SearchBar
                    locale="en"
                    defaultValue="test"
                />
            );
            fireEvent.click(screen.getByLabelText('Clear search'));
            const submitButton = screen
                .getAllByLabelText('Search')
                .find((el) => el.tagName === 'BUTTON');
            expect(submitButton).toBeDisabled();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on the text input', () => {
            render(<SearchBar locale="en" />);
            expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Search');
        });

        it('should have aria-label on the clear button', () => {
            render(
                <SearchBar
                    locale="en"
                    defaultValue="test"
                />
            );
            expect(screen.getByLabelText('Clear search')).toHaveAttribute(
                'aria-label',
                'Clear search'
            );
        });

        it('should have aria-label on the search submit button', () => {
            render(<SearchBar locale="en" />);
            const submitButton = screen
                .getAllByLabelText('Search')
                .find((el) => el.tagName === 'BUTTON');
            expect(submitButton).toHaveAttribute('aria-label', 'Search');
        });

        it('should have type="text" on the input element', () => {
            render(<SearchBar locale="en" />);
            expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
        });

        it('should have type="button" on the clear button', () => {
            render(
                <SearchBar
                    locale="en"
                    defaultValue="test"
                />
            );
            expect(screen.getByLabelText('Clear search')).toHaveAttribute('type', 'button');
        });

        it('should have type="button" on the search submit button', () => {
            render(<SearchBar locale="en" />);
            const submitButton = screen
                .getAllByLabelText('Search')
                .find((el) => el.tagName === 'BUTTON');
            expect(submitButton).toHaveAttribute('type', 'button');
        });

        it('should have focus ring styles on the input', () => {
            render(<SearchBar locale="en" />);
            expect(screen.getByRole('textbox').className).toContain('focus:ring-2');
        });

        it('should have disabled:cursor-not-allowed on submit button', () => {
            render(<SearchBar locale="en" />);
            const submitButton = screen
                .getAllByLabelText('Search')
                .find((el) => el.tagName === 'BUTTON');
            expect(submitButton?.className).toContain('disabled:cursor-not-allowed');
        });
    });
});
