/**
 * Tests for the kit billing pieces (HOS-2485): PlanSummary, Stepper, OptionCard.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    OptionCard,
    OptionCardGrid,
    PlanSummary,
    StatusPill,
    Stepper
} from '../../../../src/components/account/ui';

describe('PlanSummary (kit)', () => {
    it('renders the plan name as a heading with its status, scope, price and renewal', () => {
        // Arrange & Act
        render(
            <PlanSummary
                name="Plan Anfitrión Pro"
                status={<StatusPill tone="success">Activa</StatusPill>}
                scope="Alojamientos"
                price="$ 10.000 por mes"
                renewal="Próximo cobro: 1 de diciembre"
            >
                <p>Detalle</p>
            </PlanSummary>
        );

        // Assert
        const article = screen.getByRole('article');
        expect(
            within(article).getByRole('heading', { level: 3, name: 'Plan Anfitrión Pro' })
        ).toBeInTheDocument();
        for (const text of [
            'Activa',
            'Alojamientos',
            '$ 10.000 por mes',
            'Próximo cobro: 1 de diciembre',
            'Detalle'
        ]) {
            expect(within(article).getByText(text)).toBeInTheDocument();
        }
    });

    it('omits the lines it is not given', () => {
        render(
            <PlanSummary
                name="Plan"
                headingLevel={2}
            />
        );
        expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeInTheDocument();
        expect(screen.getByRole('article').querySelectorAll('p')).toHaveLength(0);
    });
});

describe('Stepper (kit)', () => {
    const STEPS = [
        { id: 'offer', label: 'Elegí' },
        { id: 'target', label: 'Destino' },
        { id: 'confirm', label: 'Confirmá' }
    ];

    it('marks the current step, says the progress in words and the finished ones as completed', () => {
        // Arrange & Act
        render(
            <Stepper
                steps={STEPS}
                current={1}
                label="Compra de complemento"
                locale="es"
            />
        );

        // Assert
        const nav = screen.getByRole('navigation', { name: 'Compra de complemento' });
        expect(within(nav).getByText('Paso 2 de 3')).toBeInTheDocument();
        const items = within(nav).getAllByRole('listitem');
        expect(items[1]).toHaveAttribute('aria-current', 'step');
        expect(items[0]).not.toHaveAttribute('aria-current');
        expect(items[0]).toHaveTextContent('completado');
        expect(items[2]).not.toHaveTextContent('completado');
    });

    it('clamps an out-of-range current index and renders nothing without steps', () => {
        const { rerender, container } = render(
            <Stepper
                steps={STEPS}
                current={9}
                label="x"
                locale="en"
            />
        );
        expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
        rerender(
            <Stepper
                steps={[]}
                current={0}
                label="x"
                locale="en"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});

describe('OptionCard (kit)', () => {
    it('is one native button carrying the data attributes, and runs onClick', async () => {
        // Arrange
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <OptionCardGrid>
                <OptionCard
                    title="Destacado"
                    description="Tu ficha arriba"
                    meta="Alojamientos"
                    data-testid="addon-offer-1"
                    onClick={onClick}
                />
            </OptionCardGrid>
        );

        // Act
        const card = screen.getByTestId('addon-offer-1');
        await user.click(card);

        // Assert
        expect(card.tagName).toBe('BUTTON');
        expect(card).toHaveAttribute('type', 'button');
        expect(card).toHaveTextContent('Destacado');
        expect(card).toHaveTextContent('Tu ficha arriba');
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('a disabled option shows its badge and cannot be activated', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <OptionCard
                title="Destacado"
                badge={<StatusPill tone="success">Activo</StatusPill>}
                disabled
                onClick={onClick}
            />
        );
        const card = screen.getByRole('button', { name: /Destacado/ });
        expect(card).toBeDisabled();
        await user.click(card);
        expect(onClick).not.toHaveBeenCalled();
        expect(card).toHaveTextContent('Activo');
    });
});
