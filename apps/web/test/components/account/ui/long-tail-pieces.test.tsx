/**
 * Tests for RatingStars, FilterChips and CopyField (HOS-2502, spec §6.1).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    COPY_FEEDBACK_MS,
    CopyField,
    FilterChips,
    ListRow,
    RatingStars,
    starFill
} from '../../../../src/components/account/ui';

describe('RatingStars', () => {
    it('is one image named by the label, with the stars hidden from assistive tech', () => {
        // Arrange + Act
        const { container } = render(
            <RatingStars
                value={4.5}
                label="Calificación: 4,5 de 5"
            />
        );
        // Assert
        const image = screen.getByRole('img', { name: 'Calificación: 4,5 de 5' });
        expect(image).toBeInTheDocument();
        expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
        expect(container.querySelectorAll('.star')).toHaveLength(5);
    });

    it('computes the filled share of each star, clamped to the range', () => {
        expect(starFill({ value: 3.5, index: 0 })).toBe(1);
        expect(starFill({ value: 3.5, index: 3 })).toBe(0.5);
        expect(starFill({ value: 3.5, index: 4 })).toBe(0);
        expect(starFill({ value: -2, index: 0 })).toBe(0);
    });

    it('draws a half star for a fractional value', () => {
        const { container } = render(
            <RatingStars
                value={2.5}
                label="x"
            />
        );
        const fills = Array.from(container.querySelectorAll<HTMLElement>('.fill')).map(
            (node) => node.style.inlineSize
        );
        expect(fills).toEqual(['100%', '100%', '50%', '0%', '0%']);
    });

    it('shows the number only when asked, and as decoration', () => {
        const { rerender } = render(
            <RatingStars
                value={4}
                label="x"
            />
        );
        expect(screen.queryByText('4')).not.toBeInTheDocument();
        rerender(
            <RatingStars
                value={4}
                label="x"
                showValue
            />
        );
        expect(screen.getByText('4')).toHaveAttribute('aria-hidden', 'true');
    });

    it('clamps an out-of-range or non-finite value instead of overflowing', () => {
        const { container } = render(
            <RatingStars
                value={Number.NaN}
                label="x"
            />
        );
        const fills = Array.from(container.querySelectorAll<HTMLElement>('.fill')).map(
            (node) => node.style.inlineSize
        );
        expect(fills.every((width) => width === '0%')).toBe(true);
    });
});

describe('FilterChips', () => {
    const items = [
        { value: 'all', label: 'Todos', exclusive: true },
        { value: 'pending', label: 'Pendientes', count: 3 }
    ];

    it('renders a named group of toggle buttons with aria-pressed', () => {
        render(
            <FilterChips
                label="Filtrar por estado"
                items={items}
                value="pending"
                onChange={() => undefined}
            />
        );
        expect(screen.getByRole('group', { name: 'Filtrar por estado' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Pendientes/ })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('selects a chip and clears it when pressed again', () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <FilterChips
                label="f"
                items={items}
                value={null}
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Pendientes/ }));
        expect(onChange).toHaveBeenLastCalledWith('pending');
        rerender(
            <FilterChips
                label="f"
                items={items}
                value="pending"
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Pendientes/ }));
        expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it('never clears an exclusive chip', () => {
        const onChange = vi.fn();
        render(
            <FilterChips
                label="f"
                items={items}
                value="all"
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
        expect(onChange).toHaveBeenLastCalledWith('all');
    });
});

describe('FilterChips multiple mode', () => {
    const items = [
        { value: 'all', label: 'Todos', exclusive: true },
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' }
    ];

    it('presses the exclusive chip while nothing else is selected', () => {
        render(
            <FilterChips
                mode="multiple"
                label="f"
                items={items}
                value={[]}
                onChange={() => undefined}
            />
        );
        expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('adds and removes values, and clears with the exclusive chip', () => {
        const onChange = vi.fn();
        render(
            <FilterChips
                mode="multiple"
                label="f"
                items={items}
                value={['a']}
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'B' }));
        expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
        fireEvent.click(screen.getByRole('button', { name: 'A' }));
        expect(onChange).toHaveBeenLastCalledWith([]);
        fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });
});

describe('RatingStars valueText', () => {
    it('shows the locale-formatted number instead of the plain value', () => {
        render(
            <RatingStars
                value={4.6}
                showValue
                valueText="4,6"
                label="x"
            />
        );
        expect(screen.getByText('4,6')).toBeInTheDocument();
    });
});

describe('CopyField', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('copies the value and announces it through a polite live region', async () => {
        // Arrange
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        render(
            <CopyField
                label="Enlace"
                value="https://hospeda.test/x"
                locale="es"
            />
        );
        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toBeEmptyDOMElement();
        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
        });
        // Assert
        expect(writeText).toHaveBeenCalledWith('https://hospeda.test/x');
        expect(status).toHaveTextContent('Copiado al portapapeles.');
        await act(async () => {
            vi.advanceTimersByTime(COPY_FEEDBACK_MS + 1);
        });
        expect(status).toBeEmptyDOMElement();
    });

    it('says so when the clipboard refuses, and selects the text', async () => {
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
        });
        render(
            <CopyField
                label="Enlace"
                value="abc"
                locale="es"
            />
        );
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
        });
        expect(screen.getByRole('status')).toHaveTextContent(/No pudimos copiar/);
    });

    it('shows the value in a labelled read-only input', () => {
        render(
            <CopyField
                label="Enlace"
                value="abc"
                locale="en"
            />
        );
        const input = screen.getByLabelText('Enlace');
        expect(input).toHaveValue('abc');
        expect(input).toHaveAttribute('readonly');
        expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    });
});

describe('ListRow wrapDescription', () => {
    it('lets the description wrap only when asked', () => {
        const { rerender } = render(
            <ul>
                <ListRow
                    title="t"
                    description="long text"
                />
            </ul>
        );
        expect(screen.getByText('long text').className).not.toContain('descriptionWrap');
        rerender(
            <ul>
                <ListRow
                    title="t"
                    description="long text"
                    wrapDescription
                />
            </ul>
        );
        expect(screen.getByText('long text').className).toContain('descriptionWrap');
    });
});
