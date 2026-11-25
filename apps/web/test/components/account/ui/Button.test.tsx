/**
 * Tests for Button, LinkButton and TextLink (HOS-2413 T-004).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, LinkButton, TextLink } from '../../../../src/components/account/ui';

const VARIANTS = [
    ['primary', 'primary'],
    ['secondary', 'secondary'],
    ['ghost', 'ghost'],
    ['quiet', 'quiet'],
    ['danger', 'danger'],
    ['danger-ghost', 'dangerGhost'],
    ['accent', 'accent']
] as const;

describe('Button', () => {
    it.each(VARIANTS)('renders the %s variant class', (variant, cls) => {
        // Arrange + Act
        render(<Button variant={variant}>Go</Button>);
        // Assert
        expect(screen.getByRole('button')).toHaveClass('root', cls);
    });

    it.each(['sm', 'md', 'lg'] as const)('renders the %s size class', (size) => {
        render(<Button size={size}>Go</Button>);
        expect(screen.getByRole('button')).toHaveClass(size);
    });

    it('defaults type to button, never submit', () => {
        render(<Button>Go</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('activates with Enter and Space', async () => {
        // Arrange
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Go</Button>);
        screen.getByRole('button').focus();
        // Act
        await user.keyboard('{Enter}');
        await user.keyboard(' ');
        // Assert
        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('loading sets aria-busy and blocks a second activation', () => {
        // Arrange
        const onClick = vi.fn();
        render(
            <Button
                loading
                onClick={onClick}
            >
                Save
            </Button>
        );
        const button = screen.getByRole('button');
        // Act
        fireEvent.click(button);
        // Assert
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toHaveClass('loading');
        expect(button).not.toBeDisabled();
        button.focus();
        expect(button).toHaveFocus();
        expect(onClick).not.toHaveBeenCalled();
        // The label stays in flow so the width is kept.
        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('disabled uses the native attribute', () => {
        render(<Button disabled>Go</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('renders data-help only when helpId is passed', () => {
        const { rerender } = render(<Button helpId="section:venue.carta">Go</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('data-help', 'section:venue.carta');
        rerender(<Button>Go</Button>);
        expect(screen.getByRole('button')).not.toHaveAttribute('data-help');
    });

    it('requires aria-label for iconOnly (type-level)', () => {
        // Arrange + Act
        const withLabel = (
            <Button
                iconOnly
                aria-label="Close"
            >
                x
            </Button>
        );
        const withoutLabel = (
            // @ts-expect-error iconOnly without aria-label must not compile
            <Button iconOnly>x</Button>
        );
        render(withLabel);
        // Assert: the labelled one exposes its accessible name.
        expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('iconOnly');
        expect(withoutLabel).toBeDefined();
    });
});

describe('LinkButton', () => {
    it('renders an anchor with the button recipe', () => {
        render(
            <LinkButton
                href="/mi-cuenta/"
                variant="secondary"
            >
                Go
            </LinkButton>
        );
        const link = screen.getByRole('link', { name: 'Go' });
        expect(link).toHaveAttribute('href', '/mi-cuenta/');
        expect(link).toHaveClass('root', 'secondary');
    });

    it('external adds rel, target and hidden translated text', () => {
        render(
            <LinkButton
                href="https://example.com"
                external
                locale="es"
            >
                Site
            </LinkButton>
        );
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveTextContent('(se abre en otra pestaña)');
    });
});

describe('TextLink', () => {
    it.each(['default', 'quiet', 'muted'] as const)('renders the %s tone', (tone) => {
        render(
            <TextLink
                href="/x"
                tone={tone}
            >
                Link
            </TextLink>
        );
        expect(screen.getByRole('link')).toHaveClass('root', tone);
    });

    it('external adds attributes and hidden text, in the active locale', () => {
        render(
            <TextLink
                href="https://example.com"
                external
                locale="en"
            >
                Site
            </TextLink>
        );
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveTextContent('(opens in a new tab)');
    });

    it('internal links carry no target or rel', () => {
        render(<TextLink href="/x">Link</TextLink>);
        const link = screen.getByRole('link');
        expect(link).not.toHaveAttribute('target');
        expect(link).not.toHaveAttribute('rel');
    });
});
