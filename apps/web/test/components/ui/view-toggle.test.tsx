import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewToggle } from '../../../src/components/ui/ViewToggle.client';

describe('ViewToggle.client.tsx', () => {
    describe('Props', () => {
        it('should accept defaultView prop', () => {
            render(<ViewToggle defaultView="map" />);
            const mapButton = screen.getByLabelText('Map view');
            expect(mapButton).toHaveAttribute('aria-pressed', 'true');
        });

        it('should default to grid view when defaultView is not provided', () => {
            render(<ViewToggle />);
            const gridButton = screen.getByLabelText('Grid view');
            expect(gridButton).toHaveAttribute('aria-pressed', 'true');
        });

        it('should accept onChange callback', () => {
            const handleChange = vi.fn();
            render(<ViewToggle onChange={handleChange} />);

            const mapButton = screen.getByLabelText('Map view');
            fireEvent.click(mapButton);

            expect(handleChange).toHaveBeenCalledWith('map');
            expect(handleChange).toHaveBeenCalledTimes(1);
        });

        it('should accept className prop', () => {
            const { container } = render(<ViewToggle className="custom-class" />);
            const toggleGroup = container.querySelector('fieldset');
            expect(toggleGroup).toHaveClass('custom-class');
        });
    });

    describe('Rendering', () => {
        it('should render toggle group with grid and map buttons', () => {
            render(<ViewToggle />);
            expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
            expect(screen.getByLabelText('Map view')).toBeInTheDocument();
        });

        it('should render toggle group as fieldset', () => {
            const { container } = render(<ViewToggle />);
            const toggleGroup = container.querySelector('fieldset');
            expect(toggleGroup).toBeInTheDocument();
        });

        it('should have aria-label on toggle group', () => {
            const { container } = render(<ViewToggle />);
            const toggleGroup = container.querySelector('fieldset');
            expect(toggleGroup).toHaveAttribute('aria-label', 'View toggle');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-pressed="true" on active button', () => {
            render(<ViewToggle defaultView="grid" />);
            const gridButton = screen.getByLabelText('Grid view');
            expect(gridButton).toHaveAttribute('aria-pressed', 'true');
        });

        it('should have aria-pressed="false" on inactive button', () => {
            render(<ViewToggle defaultView="grid" />);
            const mapButton = screen.getByLabelText('Map view');
            expect(mapButton).toHaveAttribute('aria-pressed', 'false');
        });

        it('should have aria-label on grid button', () => {
            render(<ViewToggle />);
            const gridButton = screen.getByLabelText('Grid view');
            expect(gridButton).toHaveAttribute('aria-label', 'Grid view');
        });

        it('should have aria-label on map button', () => {
            render(<ViewToggle />);
            const mapButton = screen.getByLabelText('Map view');
            expect(mapButton).toHaveAttribute('aria-label', 'Map view');
        });

        it('should have aria-hidden on SVG icons', () => {
            const { container } = render(<ViewToggle />);
            const icons = Array.from(container.querySelectorAll('svg'));
            for (const icon of icons) {
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have focus-visible styles', () => {
            render(<ViewToggle />);
            const gridButton = screen.getByLabelText('Grid view');
            expect(gridButton.className).toContain('focus-visible:outline');
        });
    });

    describe('Interaction', () => {
        it('should switch to map view when map button is clicked', () => {
            render(<ViewToggle defaultView="grid" />);

            const mapButton = screen.getByLabelText('Map view');
            fireEvent.click(mapButton);

            expect(mapButton).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByLabelText('Grid view')).toHaveAttribute('aria-pressed', 'false');
        });

        it('should switch to grid view when grid button is clicked', () => {
            render(<ViewToggle defaultView="map" />);

            const gridButton = screen.getByLabelText('Grid view');
            fireEvent.click(gridButton);

            expect(gridButton).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByLabelText('Map view')).toHaveAttribute('aria-pressed', 'false');
        });

        it('should call onChange with correct view when toggled', () => {
            const handleChange = vi.fn();
            render(
                <ViewToggle
                    defaultView="grid"
                    onChange={handleChange}
                />
            );

            const mapButton = screen.getByLabelText('Map view');
            fireEvent.click(mapButton);
            expect(handleChange).toHaveBeenCalledWith('map');

            const gridButton = screen.getByLabelText('Grid view');
            fireEvent.click(gridButton);
            expect(handleChange).toHaveBeenCalledWith('grid');

            expect(handleChange).toHaveBeenCalledTimes(2);
        });

        it('should update active state when same button is clicked', () => {
            const handleChange = vi.fn();
            render(<ViewToggle onChange={handleChange} />);

            const gridButton = screen.getByLabelText('Grid view');
            fireEvent.click(gridButton);

            expect(gridButton).toHaveAttribute('aria-pressed', 'true');
            expect(handleChange).toHaveBeenCalledWith('grid');
        });
    });

    describe('Styling', () => {
        it('should apply active styles to grid button when selected', () => {
            render(<ViewToggle defaultView="grid" />);
            const gridButton = screen.getByLabelText('Grid view');
            expect(gridButton.className).toContain('bg-primary');
            expect(gridButton.className).toContain('text-white');
        });

        it('should apply active styles to map button when selected', () => {
            render(<ViewToggle defaultView="map" />);
            const mapButton = screen.getByLabelText('Map view');
            expect(mapButton.className).toContain('bg-primary');
            expect(mapButton.className).toContain('text-white');
        });

        it('should apply inactive styles to non-selected buttons', () => {
            render(<ViewToggle defaultView="grid" />);
            const mapButton = screen.getByLabelText('Map view');
            expect(mapButton.className).toContain('bg-transparent');
            expect(mapButton.className).toContain('text-gray-700');
        });

        it('should have hover styles on inactive buttons', () => {
            render(<ViewToggle defaultView="grid" />);
            const mapButton = screen.getByLabelText('Map view');
            expect(mapButton.className).toContain('hover:bg-gray-100');
        });

        it('should have transition styles on buttons', () => {
            render(<ViewToggle />);
            const gridButton = screen.getByLabelText('Grid view');
            expect(gridButton.className).toContain('transition-colors');
        });

        it('should have rounded corners on toggle group', () => {
            const { container } = render(<ViewToggle />);
            const toggleGroup = container.querySelector('fieldset');
            expect(toggleGroup?.className).toContain('rounded-lg');
        });

        it('should have border on toggle group', () => {
            const { container } = render(<ViewToggle />);
            const toggleGroup = container.querySelector('fieldset');
            expect(toggleGroup?.className).toContain('border');
        });
    });

    describe('Button attributes', () => {
        it('should have type="button" on both buttons', () => {
            render(<ViewToggle />);
            const gridButton = screen.getByLabelText('Grid view');
            const mapButton = screen.getByLabelText('Map view');
            expect(gridButton).toHaveAttribute('type', 'button');
            expect(mapButton).toHaveAttribute('type', 'button');
        });

        it('should not be disabled by default', () => {
            render(<ViewToggle />);
            const gridButton = screen.getByLabelText('Grid view');
            const mapButton = screen.getByLabelText('Map view');
            expect(gridButton).not.toBeDisabled();
            expect(mapButton).not.toBeDisabled();
        });
    });
});
