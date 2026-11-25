import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandWordmark } from '@/components/brand/BrandWordmark';

describe('BrandWordmark', () => {
    it('renders a visible sans brand with one decorative mark', () => {
        const { container } = render(<BrandWordmark className="custom" />);
        expect(screen.getByText('Hospeda')).toBeVisible();
        expect(screen.getByText('Hospeda').parentElement).toHaveClass(
            'font-heading',
            'font-medium',
            'custom',
            'text-lg'
        );
        expect(screen.queryByRole('img')).toBeNull();
        expect(container.querySelectorAll('img')).toHaveLength(1);
        expect(container.querySelector('img')).toHaveAttribute('src', '/logo.webp');
        expect(container.querySelector('img')).toHaveAttribute('alt', '');
        expect(container.querySelector('img')).toHaveAttribute('aria-hidden', 'true');
    });

    it.each([
        { size: 'sm', text: 'text-base', mark: 'h-7' },
        { size: 'md', text: 'text-lg', mark: 'h-9' },
        { size: 'lg', text: 'text-2xl', mark: 'h-12' }
    ] as const)('applies the $size size', ({ size, text, mark }) => {
        const { container } = render(<BrandWordmark size={size} />);
        expect(screen.getByText('Hospeda').parentElement).toHaveClass(text);
        expect(container.querySelector('img')).toHaveClass(mark);
    });

    it('renders the caller-provided suffix muted and keeps the brand unwrapped', () => {
        render(<BrandWordmark suffix="Admin" />);
        expect(screen.getByText('Admin')).toHaveClass('text-muted-foreground');
        expect(screen.getByText('Hospeda').parentElement).toHaveClass('whitespace-nowrap');
    });

    it.each([
        'forbidden',
        'change-password'
    ])('replaces only the brand image in auth/%s', (page) => {
        const source = readFileSync(
            resolve(__dirname, `../../../src/routes/auth/${page}.tsx`),
            'utf8'
        );
        expect(source).toContain('<BrandWordmark size="lg" />');
        expect(source).not.toContain('src="/logo.webp"');
    });
});
