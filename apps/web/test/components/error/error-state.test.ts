/**
 * Tests for error state components.
 * Verifies GenericErrorState and entity-specific wrappers.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const errorDir = resolve(__dirname, '../../../src/components/error');

const genericContent = readFileSync(resolve(errorDir, 'GenericErrorState.astro'), 'utf8');
const accommodationContent = readFileSync(
    resolve(errorDir, 'AccommodationErrorState.astro'),
    'utf8'
);
const destinationContent = readFileSync(resolve(errorDir, 'DestinationErrorState.astro'), 'utf8');
const eventContent = readFileSync(resolve(errorDir, 'EventErrorState.astro'), 'utf8');
const postContent = readFileSync(resolve(errorDir, 'PostErrorState.astro'), 'utf8');

describe('GenericErrorState.astro', () => {
    describe('Props', () => {
        it('should require title prop', () => {
            expect(genericContent).toContain('title: string');
        });

        it('should require message prop', () => {
            expect(genericContent).toContain('message: string');
        });

        it('should accept optional retryHref prop', () => {
            expect(genericContent).toContain('retryHref?: string');
        });

        it('should accept optional homeHref prop', () => {
            expect(genericContent).toContain('homeHref?: string');
        });

        it('should accept optional locale prop', () => {
            expect(genericContent).toContain("locale?: 'es' | 'en' | 'pt'");
        });

        it('should default locale to es', () => {
            expect(genericContent).toContain("locale = 'es'");
        });
    });

    describe('Structure', () => {
        it('should use role="alert" for error container', () => {
            expect(genericContent).toContain('role="alert"');
        });

        it('should have icon slot for customization', () => {
            expect(genericContent).toContain('<slot name="icon">');
        });

        it('should render title as h2', () => {
            expect(genericContent).toContain('<h2');
            expect(genericContent).toContain('{title}');
        });

        it('should render message as paragraph', () => {
            expect(genericContent).toContain('{message}');
        });

        it('should conditionally render retry button', () => {
            expect(genericContent).toContain('{retryHref &&');
        });

        it('should conditionally render home link', () => {
            expect(genericContent).toContain('{homeHref &&');
        });
    });

    describe('Localization', () => {
        it('should have Spanish retry label', () => {
            expect(genericContent).toContain("retry: 'Reintentar'");
        });

        it('should have English retry label', () => {
            expect(genericContent).toContain("retry: 'Try again'");
        });

        it('should have Portuguese retry label', () => {
            expect(genericContent).toContain("retry: 'Tentar novamente'");
        });

        it('should have Spanish home label', () => {
            expect(genericContent).toContain("home: 'Volver al inicio'");
        });

        it('should have English home label', () => {
            expect(genericContent).toContain("home: 'Go to home'");
        });

        it('should have Portuguese home label', () => {
            expect(genericContent).toContain("home: 'Voltar ao início'");
        });
    });

    describe('Uses Button component', () => {
        it('should import Button component', () => {
            expect(genericContent).toContain("import Button from '../ui/Button.astro'");
        });

        it('should use Button for retry action', () => {
            expect(genericContent).toContain('<Button');
            expect(genericContent).toContain('variant="primary"');
        });
    });
});

describe('Entity-specific error states', () => {
    const entityStates = [
        { name: 'AccommodationErrorState', content: accommodationContent },
        { name: 'DestinationErrorState', content: destinationContent },
        { name: 'EventErrorState', content: eventContent },
        { name: 'PostErrorState', content: postContent }
    ];

    for (const { name, content } of entityStates) {
        describe(name, () => {
            it('should import GenericErrorState', () => {
                expect(content).toContain(
                    "import GenericErrorState from './GenericErrorState.astro'"
                );
            });

            it('should use GenericErrorState as base', () => {
                expect(content).toContain('<GenericErrorState');
            });

            it('should accept locale prop', () => {
                expect(content).toContain('locale');
            });

            it('should have localized messages for es/en/pt', () => {
                expect(content).toContain('es:');
                expect(content).toContain('en:');
                expect(content).toContain('pt:');
            });

            it('should use icon slot', () => {
                expect(content).toContain('slot="icon"');
            });
        });
    }
});
