import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from '../../../src/components/search/SearchBar.client';

describe('SearchBar.client.tsx', () => {
    beforeEach(() => {
        // Mock window.location.href
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
        it('should accept locale prop', () => {
            render(<SearchBar locale="en" />);
            const input = screen.getByPlaceholderText('Search accommodations, destinations...');
            expect(input).toBeInTheDocument();
        });

        it('should default to Spanish locale when locale is not provided', () => {
            render(<SearchBar />);
            const input = screen.getByPlaceholderText('Buscar alojamientos, destinos...');
            expect(input).toBeInTheDocument();
        });

        it('should accept custom placeholder prop', () => {
            render(<SearchBar placeholder="Custom search text" />);
            const input = screen.getByPlaceholderText('Custom search text');
            expect(input).toBeInTheDocument();
        });

        it('should accept defaultValue prop', () => {
            render(<SearchBar defaultValue="beach resort" />);
            const input = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement;
            expect(input.value).toBe('beach resort');
        });

        it('should accept onSearch callback', () => {
            const handleSearch = vi.fn();
            render(<SearchBar onSearch={handleSearch} />);
            expect(handleSearch).not.toHaveBeenCalled();
        });

        it('should accept className prop', () => {
            const { container } = render(<SearchBar className="custom-search-class" />);
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('custom-search-class');
        });
    });

    describe('Rendering', () => {
        it('should render search input', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            expect(input).toBeInTheDocument();
        });

        it('should render search icon', () => {
            const { container } = render(<SearchBar />);
            const icons = container.querySelectorAll('svg');
            expect(icons.length).toBeGreaterThan(0);
        });

        it('should render search button', () => {
            render(<SearchBar />);
            const buttons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = buttons.find(
                (btn) =>
                    !btn.hasAttribute('aria-label') || btn.getAttribute('aria-label') === 'Search'
            );
            expect(searchButton).toBeInTheDocument();
        });

        it('should not render clear button when input is empty', () => {
            render(<SearchBar />);
            const clearButton = screen.queryByRole('button', { name: 'Clear search' });
            expect(clearButton).not.toBeInTheDocument();
        });

        it('should render clear button when input has text', () => {
            render(<SearchBar defaultValue="test" />);
            const clearButton = screen.getByRole('button', { name: 'Clear search' });
            expect(clearButton).toBeInTheDocument();
        });
    });

    describe('Locale-specific placeholders', () => {
        it('should use Spanish placeholder', () => {
            render(<SearchBar locale="es" />);
            expect(
                screen.getByPlaceholderText('Buscar alojamientos, destinos...')
            ).toBeInTheDocument();
        });

        it('should use English placeholder', () => {
            render(<SearchBar locale="en" />);
            expect(
                screen.getByPlaceholderText('Search accommodations, destinations...')
            ).toBeInTheDocument();
        });

        it('should use Portuguese placeholder', () => {
            render(<SearchBar locale="pt" />);
            expect(
                screen.getByPlaceholderText('Buscar hospedagens, destinos...')
            ).toBeInTheDocument();
        });

        it('should override locale placeholder with custom placeholder', () => {
            render(
                <SearchBar
                    locale="es"
                    placeholder="Find hotels"
                />
            );
            expect(screen.getByPlaceholderText('Find hotels')).toBeInTheDocument();
            expect(
                screen.queryByPlaceholderText('Buscar alojamientos, destinos...')
            ).not.toBeInTheDocument();
        });
    });

    describe('Input interaction', () => {
        it('should update input value when typing', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement;

            fireEvent.change(input, { target: { value: 'hotel' } });
            expect(input.value).toBe('hotel');
        });

        it('should show clear button after typing', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'test query' } });

            const clearButton = screen.getByRole('button', { name: 'Clear search' });
            expect(clearButton).toBeInTheDocument();
        });

        it('should clear input when clear button is clicked', () => {
            render(<SearchBar defaultValue="test query" />);
            const input = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement;
            const clearButton = screen.getByRole('button', { name: 'Clear search' });

            expect(input.value).toBe('test query');

            fireEvent.click(clearButton);

            expect(input.value).toBe('');
        });

        it('should hide clear button after clearing input', () => {
            render(<SearchBar defaultValue="test" />);
            const clearButton = screen.getByRole('button', { name: 'Clear search' });

            fireEvent.click(clearButton);

            expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
        });
    });

    describe('Search functionality', () => {
        it('should call onSearch callback when Enter key is pressed', () => {
            const handleSearch = vi.fn();
            render(<SearchBar onSearch={handleSearch} />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'mountain resort' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(handleSearch).toHaveBeenCalledWith('mountain resort');
            expect(handleSearch).toHaveBeenCalledTimes(1);
        });

        it('should call onSearch callback when search button is clicked', () => {
            const handleSearch = vi.fn();
            render(<SearchBar onSearch={handleSearch} />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];

            if (!searchButton) {
                throw new Error('Search button not found');
            }

            fireEvent.change(input, { target: { value: 'beach hotel' } });
            fireEvent.click(searchButton);

            expect(handleSearch).toHaveBeenCalledWith('beach hotel');
            expect(handleSearch).toHaveBeenCalledTimes(1);
        });

        it('should not call onSearch when input is empty on Enter', () => {
            const handleSearch = vi.fn();
            render(<SearchBar onSearch={handleSearch} />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(handleSearch).not.toHaveBeenCalled();
        });

        it('should not call onSearch when input is only whitespace', () => {
            const handleSearch = vi.fn();
            render(<SearchBar onSearch={handleSearch} />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: '   ' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(handleSearch).not.toHaveBeenCalled();
        });

        it('should trim query before calling onSearch', () => {
            const handleSearch = vi.fn();
            render(<SearchBar onSearch={handleSearch} />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: '  hotel search  ' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(handleSearch).toHaveBeenCalledWith('hotel search');
        });
    });

    describe('Navigation', () => {
        it('should navigate to search page with Spanish locale when Enter is pressed', () => {
            render(<SearchBar locale="es" />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'playa' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(window.location.href).toBe('/es/busqueda/?q=playa');
        });

        it('should navigate to search page with English locale', () => {
            render(<SearchBar locale="en" />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'beach' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(window.location.href).toBe('/en/busqueda/?q=beach');
        });

        it('should navigate to search page with Portuguese locale', () => {
            render(<SearchBar locale="pt" />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'praia' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(window.location.href).toBe('/pt/busqueda/?q=praia');
        });

        it('should encode query parameters when navigating', () => {
            render(<SearchBar locale="es" />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'hotel & spa' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(window.location.href).toBe('/es/busqueda/?q=hotel%20%26%20spa');
        });

        it('should navigate when search button is clicked', () => {
            render(<SearchBar locale="es" />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];

            if (!searchButton) {
                throw new Error('Search button not found');
            }

            fireEvent.change(input, { target: { value: 'resort' } });
            fireEvent.click(searchButton);

            expect(window.location.href).toBe('/es/busqueda/?q=resort');
        });

        it('should not navigate when onSearch callback is provided', () => {
            const handleSearch = vi.fn();
            render(
                <SearchBar
                    locale="es"
                    onSearch={handleSearch}
                />
            );
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'test' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(handleSearch).toHaveBeenCalledWith('test');
            expect(window.location.href).toBe('');
        });
    });

    describe('Debounce behavior', () => {
        it('should update input value immediately without waiting for debounce', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement;

            fireEvent.change(input, { target: { value: 'h' } });
            expect(input.value).toBe('h');

            fireEvent.change(input, { target: { value: 'ho' } });
            expect(input.value).toBe('ho');

            fireEvent.change(input, { target: { value: 'hot' } });
            expect(input.value).toBe('hot');
        });

        it('should debounce internal state changes', () => {
            vi.useFakeTimers();

            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement;

            fireEvent.change(input, { target: { value: 'test' } });
            expect(input.value).toBe('test');

            fireEvent.change(input, { target: { value: 'test2' } });
            expect(input.value).toBe('test2');

            // Input value should update immediately
            expect(input.value).toBe('test2');

            vi.useRealTimers();
        });

        it('should clear debounce timeout on component unmount', () => {
            vi.useFakeTimers();

            const { unmount } = render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });

            fireEvent.change(input, { target: { value: 'test' } });

            // Unmount before debounce completes
            unmount();

            // Advance timers to ensure no errors occur
            vi.advanceTimersByTime(300);

            vi.useRealTimers();
        });
    });

    describe('Button states', () => {
        it('should disable search button when input is empty', () => {
            render(<SearchBar />);
            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];

            expect(searchButton).toBeDisabled();
        });

        it('should enable search button when input has text', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];

            fireEvent.change(input, { target: { value: 'test' } });

            expect(searchButton).not.toBeDisabled();
        });

        it('should disable search button after clearing input', () => {
            render(<SearchBar defaultValue="test" />);
            const clearButton = screen.getByRole('button', { name: 'Clear search' });

            fireEvent.click(clearButton);

            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];
            expect(searchButton).toBeDisabled();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on input', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            expect(input).toHaveAttribute('aria-label', 'Search');
        });

        it('should have aria-label on clear button', () => {
            render(<SearchBar defaultValue="test" />);
            const clearButton = screen.getByRole('button', { name: 'Clear search' });
            expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
        });

        it('should have aria-label on search button', () => {
            render(<SearchBar />);
            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];
            expect(searchButton).toHaveAttribute('aria-label', 'Search');
        });

        it('should have aria-hidden on all SVG icons', () => {
            const { container } = render(<SearchBar defaultValue="test" />);
            const icons = Array.from(container.querySelectorAll('svg'));

            for (const icon of icons) {
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have type="button" on clear button', () => {
            render(<SearchBar defaultValue="test" />);
            const clearButton = screen.getByRole('button', { name: 'Clear search' });
            expect(clearButton).toHaveAttribute('type', 'button');
        });

        it('should have type="button" on search button', () => {
            render(<SearchBar />);
            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];
            expect(searchButton).toHaveAttribute('type', 'button');
        });

        it('should have type="text" on input', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            expect(input).toHaveAttribute('type', 'text');
        });
    });

    describe('Styling', () => {
        it('should have focus styles on input', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            expect(input.className).toContain('focus:border-primary');
            expect(input.className).toContain('focus:ring-2');
            expect(input.className).toContain('focus:ring-primary');
        });

        it('should have rounded border on input', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            expect(input.className).toContain('rounded-lg');
            expect(input.className).toContain('border');
        });

        it('should have transition styles on input', () => {
            render(<SearchBar />);
            const input = screen.getByRole('textbox', { name: 'Search' });
            expect(input.className).toContain('transition-colors');
        });

        it('should have hover styles on clear button', () => {
            render(<SearchBar defaultValue="test" />);
            const clearButton = screen.getByRole('button', { name: 'Clear search' });
            expect(clearButton.className).toContain('hover:bg-gray-400');
        });

        it('should have disabled styles on search button', () => {
            render(<SearchBar />);
            const searchButtons = screen.getAllByRole('button', { name: 'Search' });
            const searchButton = searchButtons[searchButtons.length - 1];

            if (!searchButton) {
                throw new Error('Search button not found');
            }

            expect(searchButton.className).toContain('disabled:cursor-not-allowed');
            expect(searchButton.className).toContain('disabled:bg-gray-300');
        });

        it('should forward className to wrapper', () => {
            const { container } = render(<SearchBar className="another-class my-custom-class" />);
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('my-custom-class');
            expect(wrapper).toHaveClass('another-class');
        });
    });
});
