import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldAffix } from '../FieldAffix';

describe('FieldAffix', () => {
    it('renders only the child when no prefix/suffix', () => {
        render(
            <FieldAffix>
                <input
                    type="text"
                    aria-label="test input"
                />
            </FieldAffix>
        );
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        // No affix spans
        expect(screen.queryByText('+54')).toBeNull();
    });

    it('renders prefix text with aria-hidden', () => {
        render(
            <FieldAffix prefix="+54">
                <input
                    type="text"
                    aria-label="phone"
                />
            </FieldAffix>
        );
        const prefix = screen.getByText('+54');
        expect(prefix).toBeInTheDocument();
        expect(prefix).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders suffix text with aria-hidden', () => {
        render(
            <FieldAffix suffix="m²">
                <input
                    type="text"
                    aria-label="surface"
                />
            </FieldAffix>
        );
        const suffix = screen.getByText('m²');
        expect(suffix).toBeInTheDocument();
        expect(suffix).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders both prefix and suffix together', () => {
        render(
            <FieldAffix
                prefix="$"
                suffix="ARS"
            >
                <input
                    type="text"
                    aria-label="amount"
                />
            </FieldAffix>
        );
        expect(screen.getByText('$')).toBeInTheDocument();
        expect(screen.getByText('ARS')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('prefix uses rounded-l-md border class', () => {
        render(
            <FieldAffix prefix="https://">
                <input
                    type="text"
                    aria-label="url"
                />
            </FieldAffix>
        );
        const prefix = screen.getByText('https://');
        expect(prefix).toHaveClass('rounded-l-md');
    });

    it('suffix uses rounded-r-md border class', () => {
        render(
            <FieldAffix suffix="%">
                <input
                    type="text"
                    aria-label="percent"
                />
            </FieldAffix>
        );
        const suffix = screen.getByText('%');
        expect(suffix).toHaveClass('rounded-r-md');
    });
});
