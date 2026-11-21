/**
 * Tests for Skeleton and EmptyState (HOS-2413 T-023).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState, Skeleton } from '../../../../src/components/account/ui';

describe('Skeleton', () => {
    it.each(['text', 'title', 'circle', 'block'] as const)('%s is a busy container', (shape) => {
        const { container } = render(
            <Skeleton
                shape={shape}
                locale="es"
            />
        );
        const root = container.firstElementChild as HTMLElement;
        expect(root).toHaveAttribute('aria-busy', 'true');
        expect(root).toHaveTextContent('Cargando…');
        expect(root.querySelector(`.${shape}`)).not.toBeNull();
    });

    it('translates the hidden text and draws several text lines', () => {
        const { container } = render(
            <Skeleton
                lines={3}
                locale="en"
            />
        );
        expect(container).toHaveTextContent('Loading…');
        expect(container.querySelectorAll('.text')).toHaveLength(3);
        expect(container.querySelectorAll('.textShort')).toHaveLength(1);
    });

    it('Row and Stat are busy containers too', () => {
        const { container } = render(
            <>
                <Skeleton.Row locale="es" />
                <Skeleton.Stat locale="es" />
            </>
        );
        expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
        expect(container.querySelector('.circle')).not.toBeNull();
        expect(container.querySelector('.statNumber')).not.toBeNull();
    });

    it('stops the animation under reduced motion', () => {
        const css = readFileSync(
            resolve(__dirname, '../../../../src/components/account/ui/Skeleton.module.css'),
            'utf8'
        );
        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*{\s*\.shape\s*{\s*animation: none/);
    });
});

describe('EmptyState', () => {
    it('renders an h3 title, a decorative icon and the action', () => {
        render(
            <EmptyState
                title="Sin reseñas"
                description="Cuando recibas una, aparece acá."
                icon={<svg data-testid="icon" />}
                action={<a href="/x">Ver ayuda</a>}
            />
        );
        expect(screen.getByRole('heading', { level: 3, name: 'Sin reseñas' })).toBeInTheDocument();
        expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
        expect(screen.getByRole('link', { name: 'Ver ayuda' })).toBeInTheDocument();
    });

    it('has a compact variant', () => {
        const { container } = render(
            <EmptyState
                title="Nada"
                variant="compact"
            />
        );
        expect(container.firstElementChild).toHaveClass('emptyCompact');
    });
});
