/**
 * HOS-2589 §7.4 / §9 / AC-9 / AC-13: visible and blurred promotion cards and the
 * upsell dialog. Real i18n (es).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PromotionCards } from '../../../src/components/promotions/PromotionCards';
import { lockedItem, visibleItem } from './promotion-fixtures';

describe('PromotionCards', () => {
    it('renders a visible card with its benefit, conditions and place link', () => {
        render(
            <PromotionCards
                locale="es"
                items={[visibleItem()]}
                freeQuota={3}
                vipPlanName={null}
                showPlace
            />
        );
        const card = screen.getByText('Finde largo').closest('article');
        expect(card).not.toBeNull();
        const scoped = within(card as HTMLElement);
        expect(scoped.getByText('20% de descuento')).toBeInTheDocument();
        expect(scoped.getByText('Mínimo 2 noches')).toBeInTheDocument();
        expect(scoped.getByRole('link', { name: 'Ver Casa Río' })).toHaveAttribute(
            'href',
            expect.stringContaining('/alojamientos/casa-rio')
        );
    });

    it('AC-13: a visible «Solo VIP» card carries the VIP badge, not a lock', () => {
        render(
            <PromotionCards
                locale="es"
                items={[visibleItem({ audience: 'vip' })]}
                freeQuota={3}
                vipPlanName={null}
                showPlace={false}
            />
        );
        expect(screen.getByText('VIP')).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('AC-9: a locked card is an aria-disabled button with an accessible name and no link', () => {
        render(
            <PromotionCards
                locale="es"
                items={[lockedItem(), lockedItem({ key: 'k2', audience: 'plus' })]}
                freeQuota={3}
                vipPlanName="Viajero VIP"
                showPlace
            />
        );
        const vip = screen.getByRole('button', { name: 'Promoción solo para VIP' });
        const hidden = screen.getByRole('button', { name: 'Promoción oculta' });
        expect(vip).toHaveAttribute('aria-disabled', 'true');
        expect(hidden).toHaveAttribute('aria-disabled', 'true');
        expect(vip).toHaveTextContent('30% de descuento');
        expect(vip).toHaveTextContent('Lorem ipsu');
        expect(screen.queryByRole('link', { name: /Ver/ })).toBeNull();
    });

    it('AC-9: activating a locked card opens the dialog with X and the plan name', () => {
        render(
            <PromotionCards
                locale="es"
                items={[lockedItem()]}
                freeQuota={4}
                vipPlanName="Viajero VIP"
                showPlace
            />
        );
        const dialog = document.querySelector('dialog');
        expect(dialog?.hasAttribute('open')).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Promoción solo para VIP' }));

        expect(dialog?.hasAttribute('open')).toBe(true);
        expect(dialog).toHaveTextContent('hasta 4 promociones que no son VIP por página');
        expect(dialog).toHaveTextContent('Con el plan Viajero VIP');
        const cta = within(dialog as HTMLElement).getByRole('link', {
            name: 'Hacete VIP',
            hidden: true
        });
        expect(cta).toHaveAttribute('href', expect.stringContaining('planes/turistas/precios'));
    });

    it('the dialog drops X and the plan when the catalog could not be read', () => {
        render(
            <PromotionCards
                locale="es"
                items={[lockedItem()]}
                freeQuota={null}
                vipPlanName={null}
                showPlace
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Promoción solo para VIP' }));
        const dialog = document.querySelector('dialog');
        expect(dialog).toHaveTextContent('solo algunas promociones');
        expect(dialog).not.toHaveTextContent('ves todas las promociones');
    });
});
