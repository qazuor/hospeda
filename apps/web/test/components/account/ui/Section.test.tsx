/**
 * Tests for Section (HOS-2413 T-005).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Section } from '../../../../src/components/account/ui';

const HELP = 'section:venue.carta' as const;

describe('Section', () => {
    it('takes its accessible name from the title', () => {
        render(
            <Section
                title="Datos"
                helpId={HELP}
            >
                body
            </Section>
        );
        expect(screen.getByRole('region', { name: 'Datos' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Datos' })).toBeInTheDocument();
    });

    it('renders an h3 when headingLevel is 3', () => {
        render(
            <Section
                title="Datos"
                headingLevel={3}
                helpId={HELP}
            >
                body
            </Section>
        );
        expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('carries data-help and data-kit-section', () => {
        render(
            <Section
                title="Datos"
                helpId={HELP}
            >
                body
            </Section>
        );
        const root = screen.getByRole('region');
        expect(root).toHaveAttribute('data-help', HELP);
        expect(root).toHaveAttribute('data-kit-section');
    });

    it('renders the variant, flush, description, actions and footer', () => {
        render(
            <Section
                title="Peligro"
                description="desc"
                actions={<button type="button">a</button>}
                footer={<button type="button">f</button>}
                variant="danger"
                flush
                helpId={HELP}
            >
                body
            </Section>
        );
        const root = screen.getByRole('region');
        expect(root).toHaveClass('root', 'danger', 'flush');
        expect(screen.getByText('desc')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'a' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'f' })).toBeInTheDocument();
    });

    it('throws when nested (regression: card inside card in 7+ pages)', () => {
        // Arrange: React logs the thrown render error; keep the output clean.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        // Act + Assert
        expect(() =>
            render(
                <Section
                    title="Outer"
                    helpId={HELP}
                >
                    <Section
                        title="Inner"
                        helpId={HELP}
                    >
                        x
                    </Section>
                </Section>
            )
        ).toThrow(/cannot be nested/);
        spy.mockRestore();
    });

    it('Section.module.css has no box-shadow and no :hover rule', () => {
        // Arrange
        const css = readFileSync(
            resolve(__dirname, '../../../../src/components/account/ui/Section.module.css'),
            'utf8'
        ).replace(/\/\*[\s\S]*?\*\//g, '');
        // Assert
        expect(css).not.toMatch(/box-shadow/);
        expect(css).not.toMatch(/:hover/);
    });
});
