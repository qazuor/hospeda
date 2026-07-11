/**
 * @file CountryCodeCombobox.test.tsx
 * @description Tests for the CountryCodeCombobox component (BETA-144).
 *
 * Covers:
 * - Renders the trigger button showing the currently selected country
 * - Opens the popover (search input + listbox) on click
 * - Filters the country list as the user types in the search input
 * - Selecting an option fires onChange with the selected country and closes
 *   the popover
 * - Keyboard navigation: ArrowDown moves the active option, Enter selects it
 * - Escape closes the popover without firing onChange
 * - Renders a "no results" message when the search matches nothing
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CountryCodeComboboxProps } from '@/components/host/editor/CountryCodeCombobox.client';
import { CountryCodeCombobox } from '@/components/host/editor/CountryCodeCombobox.client';
import { PHONE_COUNTRIES } from '@/lib/phone-countries';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/host/editor/CountryCodeCombobox.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    ChevronDownIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="chevron-down-icon"
            width={size}
        />
    ),
    SearchIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="search-icon"
            width={size}
        />
    )
}));

const ARGENTINA = PHONE_COUNTRIES.find((c) => c.iso === 'AR');
const URUGUAY = PHONE_COUNTRIES.find((c) => c.iso === 'UY');

if (!ARGENTINA || !URUGUAY) {
    throw new Error('Fixture countries missing from PHONE_COUNTRIES');
}

const DEFAULT_PROPS: CountryCodeComboboxProps = {
    locale: 'es',
    value: ARGENTINA,
    onChange: vi.fn()
};

describe('CountryCodeCombobox', () => {
    it('renders a trigger button showing the currently selected country', () => {
        render(<CountryCodeCombobox {...DEFAULT_PROPS} />);

        const trigger = screen.getByRole('button', { name: /argentina/i });
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveTextContent('Argentina (+54)');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('opens the popover with a search input and listbox on click', () => {
        render(<CountryCodeCombobox {...DEFAULT_PROPS} />);

        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));

        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getAllByRole('option').length).toBe(PHONE_COUNTRIES.length);
        expect(screen.getByRole('button', { name: /argentina/i })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });

    it('filters the country list as the user types', () => {
        render(<CountryCodeCombobox {...DEFAULT_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));

        const searchInput = screen.getByRole('combobox');
        fireEvent.change(searchInput, { target: { value: 'urug' } });

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('Uruguay');
    });

    it('filters by dial code too', () => {
        render(<CountryCodeCombobox {...DEFAULT_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));

        const searchInput = screen.getByRole('combobox');
        fireEvent.change(searchInput, { target: { value: '598' } });

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('Uruguay');
    });

    it('shows a "no results" message when nothing matches', () => {
        render(<CountryCodeCombobox {...DEFAULT_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));

        const searchInput = screen.getByRole('combobox');
        fireEvent.change(searchInput, { target: { value: 'zzzzz-no-match' } });

        expect(screen.queryAllByRole('option')).toHaveLength(0);
        expect(screen.getByText('No se encontraron países')).toBeInTheDocument();
    });

    it('fires onChange with the selected country and closes the popover on select', () => {
        const onChange = vi.fn();
        render(
            <CountryCodeCombobox
                {...DEFAULT_PROPS}
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));

        const searchInput = screen.getByRole('combobox');
        fireEvent.change(searchInput, { target: { value: 'urug' } });
        fireEvent.mouseDown(screen.getByRole('option', { name: /uruguay/i }));

        expect(onChange).toHaveBeenCalledWith(URUGUAY);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('selects the highlighted option via ArrowDown + Enter', () => {
        const onChange = vi.fn();
        render(
            <CountryCodeCombobox
                {...DEFAULT_PROPS}
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));

        const searchInput = screen.getByRole('combobox');
        // Highlight starts on the current selection (Argentina, index 0).
        // ArrowDown moves to the next option (Uruguay, index 1).
        fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
        fireEvent.keyDown(searchInput, { key: 'Enter' });

        expect(onChange).toHaveBeenCalledWith(URUGUAY);
    });

    it('closes on Escape without firing onChange, and returns focus to the trigger', () => {
        const onChange = vi.fn();
        render(
            <CountryCodeCombobox
                {...DEFAULT_PROPS}
                onChange={onChange}
            />
        );
        const trigger = screen.getByRole('button', { name: /argentina/i });
        fireEvent.click(trigger);

        const searchInput = screen.getByRole('combobox');
        fireEvent.keyDown(searchInput, { key: 'Escape' });

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
        expect(trigger).toHaveFocus();
    });

    it('closes when clicking outside the trigger and popover', () => {
        render(<CountryCodeCombobox {...DEFAULT_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('marks the currently selected option with aria-selected', () => {
        render(<CountryCodeCombobox {...DEFAULT_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: /argentina/i }));

        const selectedOption = screen.getByRole('option', { name: /argentina/i });
        expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    });

    it('does not open when disabled', () => {
        render(
            <CountryCodeCombobox
                {...DEFAULT_PROPS}
                disabled
            />
        );
        const trigger = screen.getByRole('button', { name: /argentina/i });
        expect(trigger).toBeDisabled();

        fireEvent.click(trigger);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});
