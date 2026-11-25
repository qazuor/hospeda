import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandWordmark } from '@/components/shared/brand/BrandWordmark';
import styles from '@/components/shared/brand/BrandWordmark.module.css';

describe('BrandWordmark', () => {
    it('keeps the optimized source decorative and the brand visible inside its existing link', () => {
        const { container } = render(
            <a
                href="/es/"
                aria-label="Home"
            >
                <BrandWordmark
                    logoSrc="/_image/logo.webp"
                    className="custom"
                    as="span"
                />
            </a>
        );
        expect(screen.getByText('Hospeda')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/es/');
        expect(screen.queryByRole('img')).toBeNull();
        expect(container.querySelectorAll('img')).toHaveLength(1);
        expect(container.querySelector('img')).toHaveAttribute('src', '/_image/logo.webp');
        expect(container.querySelector('img')).toHaveAttribute('alt', '');
        expect(container.querySelector('img')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('Hospeda').parentElement).toHaveClass(
            styles.md,
            styles.default,
            'custom'
        );
    });

    it.each(['sm', 'md', 'lg'] as const)('applies the %s size', (size) => {
        render(
            <BrandWordmark
                logoSrc="/logo.webp"
                size={size}
            />
        );
        expect(screen.getByText('Hospeda').parentElement).toHaveClass(styles[size]);
    });

    it('supports the inverse footer tone', () => {
        render(
            <BrandWordmark
                logoSrc="/logo.webp"
                tone="inverse"
            />
        );
        expect(screen.getByText('Hospeda').parentElement).toHaveClass(styles.inverse);
    });

    it('preserves text-only callers without emitting an empty image source', () => {
        const { container } = render(<BrandWordmark logoSrc="" />);
        expect(screen.getByText('Hospeda')).toBeVisible();
        expect(container.querySelector('img')).toBeNull();
    });
});
