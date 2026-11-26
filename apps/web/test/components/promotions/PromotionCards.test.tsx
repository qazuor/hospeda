import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromotionCards } from '@/components/promotions/PromotionCards';
import { lockedItem, visibleItem } from './promotion-fixtures';

const auth = vi.hoisted(() => ({ signedIn: false }));
vi.mock('@/lib/auth-client', () => ({
    useSession: () => ({ data: auth.signedIn ? { user: {} } : null })
}));

describe('PromotionCards', () => {
    it('shows benefit conditions and a consistent place link', () => {
        render(
            <PromotionCards
                locale="es"
                items={[visibleItem()]}
                freeQuota={3}
                vipPlanName={null}
                showPlace
            />
        );

        expect(screen.getByText('Mínimo 2 noches')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Ver alojamiento' })).toHaveAttribute(
            'href',
            '/es/alojamientos/casa-rio/'
        );
    });

    it('offers sign-in without rendering the locked benefit', () => {
        auth.signedIn = false;
        render(
            <PromotionCards
                locale="es"
                items={[lockedItem()]}
                freeQuota={0}
                vipPlanName="Explorer"
                showPlace
            />
        );

        const card = screen.getByRole('article');
        expect(within(card).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
            'href',
            expect.stringContaining('/auth/signin/')
        );
        expect(card).not.toHaveTextContent('Lorem ipsu');
        expect(card).not.toHaveTextContent('30%');
    });

    it('distinguishes the free quota from plan exclusivity for signed-in users', () => {
        auth.signedIn = true;
        render(
            <PromotionCards
                locale="es"
                items={[lockedItem(), lockedItem({ key: 'k2', audience: 'plus' })]}
                freeQuota={3}
                vipPlanName="Explorer"
                showPlace
            />
        );

        expect(
            screen.getByRole('heading', { name: 'Cupo del plan gratis completo' })
        ).toBeVisible();
        expect(
            screen.getByRole('heading', { name: 'Promoción exclusiva del plan Explorer' })
        ).toBeVisible();
        expect(screen.getAllByRole('link', { name: 'Conocé el plan Explorer' })).toHaveLength(2);
    });
});
