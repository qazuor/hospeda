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

        expect(screen.getByRole('heading', { name: 'Finde largo' })).toBeVisible();
        expect(screen.getByText('20% de descuento')).toBeVisible();
        expect(screen.getByText('Mínimo 2 noches')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Ver alojamiento' })).toHaveAttribute(
            'href',
            '/es/alojamientos/casa-rio/'
        );
    });

    it('preserves a longer marketing title and shows the catalog badge and free-night benefit', () => {
        render(
            <PromotionCards
                locale="es"
                items={[
                    visibleItem({
                        audience: 'vip',
                        title: 'Finde largo junto al río',
                        description: 'Finde largo',
                        discountType: 'free_night'
                    })
                ]}
                freeQuota={3}
                vipPlanName="Explorer"
                showPlace
            />
        );

        expect(screen.getByRole('heading', { name: 'Finde largo junto al río' })).toBeVisible();
        expect(screen.queryByText('Finde largo', { exact: true })).not.toBeInTheDocument();
        expect(screen.getByText('Noche gratis')).toBeVisible();
        expect(screen.getByText('Explorer')).toBeVisible();
    });

    it('shows the benefit just once when marketing copy duplicates it', () => {
        render(
            <PromotionCards
                locale="es"
                items={[
                    visibleItem({ title: '20% de descuento', description: '20% de descuento.' })
                ]}
                freeQuota={3}
                vipPlanName={null}
                showPlace
            />
        );

        expect(screen.getByText(/^20% de descuento\.?$/i)).toBeVisible();
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
