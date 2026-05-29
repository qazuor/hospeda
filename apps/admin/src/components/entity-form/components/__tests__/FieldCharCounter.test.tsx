import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldCharCounter } from '../FieldCharCounter';

describe('FieldCharCounter', () => {
    it('renders nothing when max is undefined', () => {
        const { container } = render(
            <FieldCharCounter
                current={50}
                max={undefined}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders "current / max" when max is provided', () => {
        render(
            <FieldCharCounter
                current={178}
                max={300}
            />
        );
        expect(screen.getByText('178 / 300')).toBeInTheDocument();
    });

    it('uses muted color when under the limit', () => {
        render(
            <FieldCharCounter
                current={100}
                max={300}
            />
        );
        const el = screen.getByText('100 / 300');
        expect(el).toHaveClass('text-muted-foreground');
        expect(el).not.toHaveClass('text-destructive');
    });

    it('uses destructive color when at or over the limit', () => {
        render(
            <FieldCharCounter
                current={300}
                max={300}
            />
        );
        const el = screen.getByText('300 / 300');
        expect(el).toHaveClass('text-destructive');
    });

    it('has aria-live polite for screen readers', () => {
        render(
            <FieldCharCounter
                current={10}
                max={100}
            />
        );
        expect(screen.getByText('10 / 100')).toHaveAttribute('aria-live', 'polite');
    });
});
