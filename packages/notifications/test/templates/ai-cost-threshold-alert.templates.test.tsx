/**
 * AI Cost Threshold Alert Email Template Test Suite (SPEC-173 T-025)
 *
 * Tests for the AiCostThresholdAlert email template including:
 * - Template renders without errors for all threshold bands (50/80/100%)
 * - Required fields from payload are present in rendered HTML
 * - Spanish text is present
 * - USD formatting from micro-USD values is correct
 * - Scope labels (global vs feature) are displayed correctly
 * - Warning box is displayed for 80% and 100% bands
 * - Admin badge is present
 * - No unsubscribe link (ADMIN category always sends)
 *
 * @module test/templates/ai-cost-threshold-alert.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AiCostThresholdAlert,
    type AiCostThresholdAlertProps
} from '../../src/templates/admin/ai-cost-threshold-alert';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const GLOBAL_50_PROPS: AiCostThresholdAlertProps = {
    recipientName: 'Admin Principal',
    scope: 'global',
    thresholdPct: 50,
    spentMicroUsd: 100_000_000, // $0.1000 USD
    ceilingMicroUsd: 200_000_000, // $0.2000 USD
    period: '2026-06'
};

const GLOBAL_80_PROPS: AiCostThresholdAlertProps = {
    ...GLOBAL_50_PROPS,
    thresholdPct: 80,
    spentMicroUsd: 160_000_000 // $0.1600 USD
};

const GLOBAL_100_PROPS: AiCostThresholdAlertProps = {
    ...GLOBAL_50_PROPS,
    thresholdPct: 100,
    spentMicroUsd: 200_000_000 // $0.2000 USD
};

const FEATURE_50_PROPS: AiCostThresholdAlertProps = {
    recipientName: 'Admin Técnico',
    scope: 'feature',
    feature: 'chat',
    thresholdPct: 50,
    spentMicroUsd: 50_000_000, // $0.0500 USD
    ceilingMicroUsd: 100_000_000, // $0.1000 USD
    period: '2026-06'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiCostThresholdAlert template', () => {
    describe('rendering without errors', () => {
        it('should render the 50% global alert without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(render).not.toThrow();
        });

        it('should render the 80% global alert without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_80_PROPS));

            // Assert
            expect(render).not.toThrow();
        });

        it('should render the 100% global alert without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_100_PROPS));

            // Assert
            expect(render).not.toThrow();
        });

        it('should render the 50% feature alert without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AiCostThresholdAlert(FEATURE_50_PROPS));

            // Assert
            expect(render).not.toThrow();
        });
    });

    describe('Spanish text and headings', () => {
        it('should include the Spanish heading', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('Alerta de Costo de IA');
        });

        it('should include a greeting with recipient name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('Hola');
            expect(html).toContain('Admin Principal');
        });

        it('should include the admin badge', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('NOTIFICACIÓN ADMINISTRATIVA');
        });

        it('should include the details section title in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('Detalles del Gasto');
        });

        it('should include the footer note in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('notificación automática del sistema');
            expect(html).toContain('panel de administración');
        });
    });

    describe('threshold band labels', () => {
        it('should display AVISO (50%) label for 50% band', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('AVISO (50%)');
        });

        it('should display ADVERTENCIA (80%) label for 80% band', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_80_PROPS));

            // Assert
            expect(html).toContain('ADVERTENCIA (80%)');
        });

        it('should display LÍMITE ALCANZADO (100%) label for 100% band', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_100_PROPS));

            // Assert
            expect(html).toContain('LÍMITE ALCANZADO (100%)');
        });
    });

    describe('period and threshold values', () => {
        it('should include the period in the rendered HTML', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('2026-06');
        });

        it('should include the threshold percentage', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_80_PROPS));

            // Assert
            expect(html).toContain('80%');
        });
    });

    describe('USD formatting from micro-USD values', () => {
        it('should display spent amount as USD with 4 decimal places', () => {
            // Arrange — spentMicroUsd = 100_000_000 µUSD = $100.0000 USD
            // (1 USD = 1_000_000 µUSD, so 100_000_000 µUSD = $100 USD)
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('$100.0000 USD');
        });

        it('should display ceiling amount as USD with 4 decimal places', () => {
            // Arrange — ceilingMicroUsd = 200_000_000 µUSD = $200.0000 USD
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('$200.0000 USD');
        });

        it('should format a fractional-dollar micro-USD value correctly', () => {
            // Arrange — 500_000 µUSD = $0.5000 USD
            const props: AiCostThresholdAlertProps = {
                ...GLOBAL_50_PROPS,
                spentMicroUsd: 500_000,
                ceilingMicroUsd: 1_000_000
            };
            const html = renderToStaticMarkup(AiCostThresholdAlert(props));

            // Assert
            expect(html).toContain('$0.5000 USD');
            expect(html).toContain('$1.0000 USD');
        });
    });

    describe('scope labels', () => {
        it('should display "Global" scope label for global scope', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert
            expect(html).toContain('Global');
        });

        it('should display the feature name for feature scope', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(FEATURE_50_PROPS));

            // Assert
            expect(html).toContain('chat');
            expect(html).toContain('Funcionalidad');
        });

        it('should handle missing feature name for feature scope gracefully', () => {
            // Arrange
            const propsNoFeature: AiCostThresholdAlertProps = {
                ...FEATURE_50_PROPS,
                feature: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(AiCostThresholdAlert(propsNoFeature));

            // Assert
            expect(render).not.toThrow();
        });
    });

    describe('warning boxes', () => {
        it('should display a critical warning box for 100% threshold', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_100_PROPS));

            // Assert
            expect(html).toContain('agotado');
            expect(html).toContain('siendo bloqueadas');
        });

        it('should display an informational warning box for 80% threshold', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_80_PROPS));

            // Assert
            expect(html).toContain('80%');
            expect(html).toContain('Revisá el panel de administración');
        });

        it('should NOT display a warning box for 50% threshold', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert — no blocking or 80% specific messages
            expect(html).not.toContain('siendo bloqueadas');
            expect(html).not.toContain('Revisá el panel de administración');
        });
    });

    describe('admin-only behavior', () => {
        it('should NOT include an unsubscribe link', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AiCostThresholdAlert(GLOBAL_50_PROPS));

            // Assert — admin notifications should NOT have unsubscribe
            expect(html).not.toContain('Cancelar suscripción');
            expect(html).not.toContain('preferencias de notificaciones');
        });
    });
});
