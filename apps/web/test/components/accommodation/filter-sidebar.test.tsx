import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterSidebar } from '../../../src/components/accommodation/FilterSidebar.client';
import type { AccommodationFilters } from '../../../src/components/accommodation/FilterSidebar.client';

describe('FilterSidebar.client.tsx', () => {
    // Mock window.history.pushState
    const originalPushState = window.history.pushState;

    beforeEach(() => {
        window.history.pushState = vi.fn();
        // Reset URL before each test
        window.history.replaceState({}, '', '/');
    });

    afterEach(() => {
        window.history.pushState = originalPushState;
    });

    describe('Props', () => {
        it('should accept initialFilters prop', () => {
            const initialFilters: Partial<AccommodationFilters> = {
                types: ['hotel'],
                destination: 'colon'
            };

            render(<FilterSidebar initialFilters={initialFilters} />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            expect(hotelCheckbox).toBeChecked();

            const destinationSelect = screen.getByRole('combobox');
            expect(destinationSelect).toHaveValue('colon');
        });

        it('should default locale to "es"', () => {
            render(<FilterSidebar />);
            expect(screen.getByText('Filtros')).toBeInTheDocument();
            expect(screen.getByText('Tipo de alojamiento')).toBeInTheDocument();
        });

        it('should accept locale prop and display English labels', () => {
            render(<FilterSidebar locale="en" />);
            expect(screen.getByText('Filters')).toBeInTheDocument();
            expect(screen.getByText('Accommodation type')).toBeInTheDocument();
        });

        it('should accept className prop', () => {
            const { container } = render(<FilterSidebar className="custom-sidebar-class" />);
            const aside = container.querySelector('aside');
            expect(aside).toHaveClass('custom-sidebar-class');
        });
    });

    describe('Rendering', () => {
        it('should render all filter sections', () => {
            render(<FilterSidebar />);

            expect(screen.getByText('Tipo de alojamiento')).toBeInTheDocument();
            expect(screen.getByText('Rango de precio')).toBeInTheDocument();
            expect(screen.getByText('Destino')).toBeInTheDocument();
            expect(screen.getByText('Servicios')).toBeInTheDocument();
            expect(screen.getByText('Calificación mínima')).toBeInTheDocument();
        });

        it('should render type checkboxes', () => {
            render(<FilterSidebar />);

            expect(screen.getByLabelText('Hotel')).toBeInTheDocument();
            expect(screen.getByLabelText('Cabaña')).toBeInTheDocument();
            expect(screen.getByLabelText('Apartamento')).toBeInTheDocument();
            expect(screen.getByLabelText('Rural')).toBeInTheDocument();
            expect(screen.getByLabelText('Hostal')).toBeInTheDocument();
            expect(screen.getByLabelText('Boutique')).toBeInTheDocument();
        });

        it('should render price min/max inputs', () => {
            render(<FilterSidebar />);

            expect(screen.getByLabelText('Mínimo')).toBeInTheDocument();
            expect(screen.getByLabelText('Máximo')).toBeInTheDocument();
        });

        it('should render destination select', () => {
            render(<FilterSidebar />);

            const destinationSelect = screen.getByRole('combobox');
            expect(destinationSelect).toBeInTheDocument();
            expect(screen.getByText('Todos los destinos')).toBeInTheDocument();
            expect(screen.getByText('Concepción del Uruguay')).toBeInTheDocument();
            expect(screen.getByText('Colón')).toBeInTheDocument();
        });

        it('should render amenity checkboxes', () => {
            render(<FilterSidebar />);

            expect(screen.getByLabelText('WiFi')).toBeInTheDocument();
            expect(screen.getByLabelText('Piscina')).toBeInTheDocument();
            expect(screen.getByLabelText('Estacionamiento')).toBeInTheDocument();
            expect(screen.getByLabelText('Desayuno')).toBeInTheDocument();
            expect(screen.getByLabelText('Aire acondicionado')).toBeInTheDocument();
            expect(screen.getByLabelText('Gimnasio')).toBeInTheDocument();
            expect(screen.getByLabelText('Restaurante')).toBeInTheDocument();
            expect(screen.getByLabelText('Admite mascotas')).toBeInTheDocument();
        });

        it('should render 5 stars for rating', () => {
            render(<FilterSidebar />);

            expect(screen.getByLabelText('1 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('2 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('3 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('4 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('5 estrellas')).toBeInTheDocument();
        });
    });

    describe('Type Filter', () => {
        it('should toggle type checkbox correctly', () => {
            render(<FilterSidebar />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            expect(hotelCheckbox).not.toBeChecked();

            fireEvent.click(hotelCheckbox);
            expect(hotelCheckbox).toBeChecked();

            fireEvent.click(hotelCheckbox);
            expect(hotelCheckbox).not.toBeChecked();
        });

        it('should allow multiple types to be selected', () => {
            render(<FilterSidebar />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            const cabinCheckbox = screen.getByLabelText('Cabaña');

            fireEvent.click(hotelCheckbox);
            fireEvent.click(cabinCheckbox);

            expect(hotelCheckbox).toBeChecked();
            expect(cabinCheckbox).toBeChecked();
        });
    });

    describe('Price Filter', () => {
        it('should accept minimum price input', () => {
            render(<FilterSidebar />);

            const priceMinInput = screen.getByLabelText('Mínimo');
            fireEvent.change(priceMinInput, { target: { value: '1000' } });

            expect(priceMinInput).toHaveValue(1000);
        });

        it('should accept maximum price input', () => {
            render(<FilterSidebar />);

            const priceMaxInput = screen.getByLabelText('Máximo');
            fireEvent.change(priceMaxInput, { target: { value: '5000' } });

            expect(priceMaxInput).toHaveValue(5000);
        });
    });

    describe('Destination Filter', () => {
        it('should change destination value', () => {
            render(<FilterSidebar />);

            const destinationSelect = screen.getByRole('combobox');
            fireEvent.change(destinationSelect, { target: { value: 'colon' } });

            expect(destinationSelect).toHaveValue('colon');
        });
    });

    describe('Amenity Filter', () => {
        it('should toggle amenity checkbox correctly', () => {
            render(<FilterSidebar />);

            const wifiCheckbox = screen.getByLabelText('WiFi');
            expect(wifiCheckbox).not.toBeChecked();

            fireEvent.click(wifiCheckbox);
            expect(wifiCheckbox).toBeChecked();

            fireEvent.click(wifiCheckbox);
            expect(wifiCheckbox).not.toBeChecked();
        });

        it('should allow multiple amenities to be selected', () => {
            render(<FilterSidebar />);

            const wifiCheckbox = screen.getByLabelText('WiFi');
            const poolCheckbox = screen.getByLabelText('Piscina');

            fireEvent.click(wifiCheckbox);
            fireEvent.click(poolCheckbox);

            expect(wifiCheckbox).toBeChecked();
            expect(poolCheckbox).toBeChecked();
        });
    });

    describe('Rating Filter', () => {
        it('should select rating when star is clicked', () => {
            render(<FilterSidebar />);

            const thirdStar = screen.getByLabelText('3 estrellas');
            fireEvent.click(thirdStar);

            // Check that stars are filled up to the clicked one
            const stars = [
                screen.getByLabelText('1 estrellas'),
                screen.getByLabelText('2 estrellas'),
                screen.getByLabelText('3 estrellas'),
                screen.getByLabelText('4 estrellas'),
                screen.getByLabelText('5 estrellas')
            ];

            const filledStars = stars.filter((star, index) => {
                const svg = star.querySelector('svg');
                return index < 3 && svg?.getAttribute('fill') === 'currentColor';
            });

            expect(filledStars).toHaveLength(3);
        });

        it('should update rating when different star is clicked', () => {
            render(<FilterSidebar />);

            const secondStar = screen.getByLabelText('2 estrellas');
            fireEvent.click(secondStar);

            const fifthStar = screen.getByLabelText('5 estrellas');
            fireEvent.click(fifthStar);

            const stars = [
                screen.getByLabelText('1 estrellas'),
                screen.getByLabelText('2 estrellas'),
                screen.getByLabelText('3 estrellas'),
                screen.getByLabelText('4 estrellas'),
                screen.getByLabelText('5 estrellas')
            ];

            const filledStars = stars.filter((star) => {
                const svg = star.querySelector('svg');
                return svg?.getAttribute('fill') === 'currentColor';
            });

            expect(filledStars).toHaveLength(5);
        });
    });

    describe('Active Filter Badges', () => {
        it('should not show active filters section when no filters are set', () => {
            render(<FilterSidebar />);
            expect(screen.queryByText('Filtros activos')).not.toBeInTheDocument();
        });

        it('should show active filters section when filters are set', () => {
            render(<FilterSidebar />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            fireEvent.click(hotelCheckbox);

            expect(screen.getByText('Filtros activos')).toBeInTheDocument();
        });

        it('should display type filter badge', () => {
            render(<FilterSidebar />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            fireEvent.click(hotelCheckbox);

            // Badge should show "Hotel" text
            const badges = screen.getAllByText('Hotel');
            expect(badges.length).toBeGreaterThan(1); // One in checkbox label, one in badge
        });

        it('should display price min filter badge', () => {
            render(<FilterSidebar />);

            const priceMinInput = screen.getByLabelText('Mínimo');
            fireEvent.change(priceMinInput, { target: { value: '1000' } });

            expect(screen.getByText('Mínimo: $1000')).toBeInTheDocument();
        });

        it('should display price max filter badge', () => {
            render(<FilterSidebar />);

            const priceMaxInput = screen.getByLabelText('Máximo');
            fireEvent.change(priceMaxInput, { target: { value: '5000' } });

            expect(screen.getByText('Máximo: $5000')).toBeInTheDocument();
        });

        it('should display destination filter badge', () => {
            render(<FilterSidebar />);

            const destinationSelect = screen.getByRole('combobox');
            fireEvent.change(destinationSelect, { target: { value: 'colon' } });

            const colonElements = screen.getAllByText('Colón');
            expect(colonElements.length).toBeGreaterThan(1); // One in select option, one in badge
        });

        it('should display amenity filter badge', () => {
            render(<FilterSidebar />);

            const wifiCheckbox = screen.getByLabelText('WiFi');
            fireEvent.click(wifiCheckbox);

            const badges = screen.getAllByText('WiFi');
            expect(badges.length).toBeGreaterThan(1);
        });

        it('should display rating filter badge', () => {
            render(<FilterSidebar />);

            const thirdStar = screen.getByLabelText('3 estrellas');
            fireEvent.click(thirdStar);

            expect(screen.getByText('3+ estrellas')).toBeInTheDocument();
        });
    });

    describe('Individual Filter Clear', () => {
        it('should remove type filter when X button is clicked', async () => {
            render(<FilterSidebar />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            fireEvent.click(hotelCheckbox);

            const removeButton = screen.getByLabelText('Quitar filtro Hotel');
            fireEvent.click(removeButton);

            await waitFor(() => {
                expect(hotelCheckbox).not.toBeChecked();
            });
        });

        it('should remove price min filter when X button is clicked', async () => {
            render(<FilterSidebar />);

            const priceMinInput = screen.getByLabelText('Mínimo');
            fireEvent.change(priceMinInput, { target: { value: '1000' } });

            const removeButton = screen.getByLabelText('Quitar filtro Mínimo');
            fireEvent.click(removeButton);

            await waitFor(() => {
                expect(priceMinInput).toHaveValue(null);
            });
        });

        it('should remove price max filter when X button is clicked', async () => {
            render(<FilterSidebar />);

            const priceMaxInput = screen.getByLabelText('Máximo');
            fireEvent.change(priceMaxInput, { target: { value: '5000' } });

            const removeButton = screen.getByLabelText('Quitar filtro Máximo');
            fireEvent.click(removeButton);

            await waitFor(() => {
                expect(priceMaxInput).toHaveValue(null);
            });
        });

        it('should remove destination filter when X button is clicked', async () => {
            render(<FilterSidebar />);

            const destinationSelect = screen.getByRole('combobox');
            fireEvent.change(destinationSelect, { target: { value: 'colon' } });

            const removeButton = screen.getByLabelText('Quitar filtro Destino');
            fireEvent.click(removeButton);

            await waitFor(() => {
                expect(destinationSelect).toHaveValue('');
            });
        });

        it('should remove amenity filter when X button is clicked', async () => {
            render(<FilterSidebar />);

            const wifiCheckbox = screen.getByLabelText('WiFi');
            fireEvent.click(wifiCheckbox);

            const removeButton = screen.getByLabelText('Quitar filtro WiFi');
            fireEvent.click(removeButton);

            await waitFor(() => {
                expect(wifiCheckbox).not.toBeChecked();
            });
        });

        it('should remove rating filter when X button is clicked', async () => {
            render(<FilterSidebar />);

            const thirdStar = screen.getByLabelText('3 estrellas');
            fireEvent.click(thirdStar);

            const removeButton = screen.getByLabelText('Quitar filtro Calificación mínima');
            fireEvent.click(removeButton);

            await waitFor(() => {
                expect(screen.queryByText('3+ estrellas')).not.toBeInTheDocument();
            });
        });
    });

    describe('Clear All Filters', () => {
        it('should clear all filters when clear all button is clicked', async () => {
            render(<FilterSidebar />);

            // Set multiple filters
            const hotelCheckbox = screen.getByLabelText('Hotel');
            fireEvent.click(hotelCheckbox);

            const priceMinInput = screen.getByLabelText('Mínimo');
            fireEvent.change(priceMinInput, { target: { value: '1000' } });

            const wifiCheckbox = screen.getByLabelText('WiFi');
            fireEvent.click(wifiCheckbox);

            // Click clear all
            const clearAllButton = screen.getByText('Limpiar filtros');
            fireEvent.click(clearAllButton);

            await waitFor(() => {
                expect(hotelCheckbox).not.toBeChecked();
                expect(priceMinInput).toHaveValue(null);
                expect(wifiCheckbox).not.toBeChecked();
                expect(screen.queryByText('Filtros activos')).not.toBeInTheDocument();
            });
        });
    });

    describe('URL Synchronization', () => {
        it('should update URL when type filter is changed', () => {
            render(<FilterSidebar />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            fireEvent.click(hotelCheckbox);

            expect(window.history.pushState).toHaveBeenCalledWith(
                {},
                '',
                expect.stringContaining('types=hotel')
            );
        });

        it('should update URL when price filters are changed', () => {
            render(<FilterSidebar />);

            const priceMinInput = screen.getByLabelText('Mínimo');
            fireEvent.change(priceMinInput, { target: { value: '1000' } });

            expect(window.history.pushState).toHaveBeenCalledWith(
                {},
                '',
                expect.stringContaining('priceMin=1000')
            );
        });

        it('should update URL when destination is changed', () => {
            render(<FilterSidebar />);

            const destinationSelect = screen.getByRole('combobox');
            fireEvent.change(destinationSelect, { target: { value: 'colon' } });

            expect(window.history.pushState).toHaveBeenCalledWith(
                {},
                '',
                expect.stringContaining('destination=colon')
            );
        });

        it('should update URL when amenity filter is changed', () => {
            render(<FilterSidebar />);

            const wifiCheckbox = screen.getByLabelText('WiFi');
            fireEvent.click(wifiCheckbox);

            expect(window.history.pushState).toHaveBeenCalledWith(
                {},
                '',
                expect.stringContaining('amenities=wifi')
            );
        });

        it('should update URL when rating is changed', () => {
            render(<FilterSidebar />);

            const thirdStar = screen.getByLabelText('3 estrellas');
            fireEvent.click(thirdStar);

            expect(window.history.pushState).toHaveBeenCalledWith(
                {},
                '',
                expect.stringContaining('minRating=3')
            );
        });

        it('should handle multiple filters in URL', () => {
            render(<FilterSidebar />);

            const hotelCheckbox = screen.getByLabelText('Hotel');
            fireEvent.click(hotelCheckbox);

            const wifiCheckbox = screen.getByLabelText('WiFi');
            fireEvent.click(wifiCheckbox);

            const lastCall = (
                window.history.pushState as ReturnType<typeof vi.fn>
            ).mock.calls.slice(-1)[0] as unknown[];
            expect(lastCall?.[2]).toContain('types=hotel');
            expect(lastCall?.[2]).toContain('amenities=wifi');
        });
    });

    describe('Locale Switching', () => {
        it('should display Spanish labels when locale is "es"', () => {
            render(<FilterSidebar locale="es" />);

            expect(screen.getByText('Filtros')).toBeInTheDocument();
            expect(screen.getByText('Tipo de alojamiento')).toBeInTheDocument();
            expect(screen.getByText('Rango de precio')).toBeInTheDocument();
            expect(screen.getByText('Destino')).toBeInTheDocument();
            expect(screen.getByText('Servicios')).toBeInTheDocument();
            expect(screen.getByText('Calificación mínima')).toBeInTheDocument();
        });

        it('should display English labels when locale is "en"', () => {
            render(<FilterSidebar locale="en" />);

            expect(screen.getByText('Filters')).toBeInTheDocument();
            expect(screen.getByText('Accommodation type')).toBeInTheDocument();
            expect(screen.getByText('Price range')).toBeInTheDocument();
            expect(screen.getByText('Destination')).toBeInTheDocument();
            expect(screen.getByText('Amenities')).toBeInTheDocument();
            expect(screen.getByText('Minimum rating')).toBeInTheDocument();
        });

        it('should display Spanish type labels', () => {
            render(<FilterSidebar locale="es" />);

            expect(screen.getByLabelText('Hotel')).toBeInTheDocument();
            expect(screen.getByLabelText('Cabaña')).toBeInTheDocument();
            expect(screen.getByLabelText('Apartamento')).toBeInTheDocument();
        });

        it('should display English type labels', () => {
            render(<FilterSidebar locale="en" />);

            expect(screen.getByLabelText('Hotel')).toBeInTheDocument();
            expect(screen.getByLabelText('Cabin')).toBeInTheDocument();
            expect(screen.getByLabelText('Apartment')).toBeInTheDocument();
        });
    });

    describe('Collapsible Sections', () => {
        it('should expand and collapse type section', () => {
            render(<FilterSidebar />);

            const typeButton = screen.getByText('Tipo de alojamiento');
            expect(screen.getByLabelText('Hotel')).toBeInTheDocument();

            fireEvent.click(typeButton);
            expect(screen.queryByLabelText('Hotel')).not.toBeInTheDocument();

            fireEvent.click(typeButton);
            expect(screen.getByLabelText('Hotel')).toBeInTheDocument();
        });

        it('should expand and collapse price section', () => {
            render(<FilterSidebar />);

            const priceButton = screen.getByText('Rango de precio');
            expect(screen.getByLabelText('Mínimo')).toBeInTheDocument();

            fireEvent.click(priceButton);
            expect(screen.queryByLabelText('Mínimo')).not.toBeInTheDocument();

            fireEvent.click(priceButton);
            expect(screen.getByLabelText('Mínimo')).toBeInTheDocument();
        });

        it('should expand and collapse destination section', () => {
            render(<FilterSidebar />);

            const destinationButton = screen.getByText('Destino');
            expect(screen.getByRole('combobox')).toBeInTheDocument();

            fireEvent.click(destinationButton);
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

            fireEvent.click(destinationButton);
            expect(screen.getByRole('combobox')).toBeInTheDocument();
        });

        it('should have aria-expanded attribute on section buttons', () => {
            render(<FilterSidebar />);

            const typeButton = screen.getByText('Tipo de alojamiento');
            expect(typeButton).toHaveAttribute('aria-expanded', 'true');

            fireEvent.click(typeButton);
            expect(typeButton).toHaveAttribute('aria-expanded', 'false');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on sidebar', () => {
            const { container } = render(<FilterSidebar />);
            const aside = container.querySelector('aside');
            expect(aside).toHaveAttribute('aria-label', 'Filtros');
        });

        it('should have aria-expanded on collapsible sections', () => {
            render(<FilterSidebar />);

            const typeButton = screen.getByText('Tipo de alojamiento');
            expect(typeButton).toHaveAttribute('aria-expanded');
        });

        it('should have aria-hidden on decorative SVGs', () => {
            const { container } = render(<FilterSidebar />);

            const decorativeSvgs = container.querySelectorAll('svg[aria-hidden="true"]');
            expect(decorativeSvgs.length).toBeGreaterThan(0);
        });

        it('should have focus-visible styles on interactive elements', () => {
            render(<FilterSidebar />);

            const firstStar = screen.getByLabelText('1 estrellas');
            expect(firstStar.className).toContain('focus-visible:outline');
        });

        it('should have aria-label on star rating buttons', () => {
            render(<FilterSidebar />);

            expect(screen.getByLabelText('1 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('2 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('3 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('4 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('5 estrellas')).toBeInTheDocument();
        });
    });

    describe('Styling', () => {
        it('should apply custom className to sidebar', () => {
            const { container } = render(<FilterSidebar className="custom-class" />);
            const aside = container.querySelector('aside');
            expect(aside).toHaveClass('custom-class');
        });

        it('should have transition styles on star buttons', () => {
            render(<FilterSidebar />);

            const firstStar = screen.getByLabelText('1 estrellas');
            expect(firstStar.className).toContain('transition-transform');
        });

        it('should have hover scale effect on star buttons', () => {
            render(<FilterSidebar />);

            const firstStar = screen.getByLabelText('1 estrellas');
            expect(firstStar.className).toContain('hover:scale-110');
        });

        it('should have rotate animation on section toggle icons', () => {
            render(<FilterSidebar />);

            const typeButton = screen.getByText('Tipo de alojamiento');
            const chevronIcon = typeButton.querySelector('svg');

            const classValue = chevronIcon?.getAttribute('class') ?? '';
            expect(classValue).toContain('transition-transform');
            expect(classValue).toContain('rotate-180');

            fireEvent.click(typeButton);

            const newClassValue = chevronIcon?.getAttribute('class') ?? '';
            expect(newClassValue).not.toContain('rotate-180');
        });
    });
});
