import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VipGateDialog } from '@/components/account/ui/VipGateDialog';
import { formatPrice } from '@/lib/format-utils';

const readPlan = vi.hoisted(() => vi.fn());
vi.mock('@/components/account/ui/read-tourist-vip-plan', () => ({ readTouristVipPlan: readPlan }));

const plan = { monthlyOptionId: 'monthly-option', monthlyPriceArs: 987654 };
const props = {
    open: true,
    onClose: vi.fn(),
    locale: 'es' as const,
    apiUrl: 'https://api.example.test',
    title: 'VIP gate',
    body: 'VIP membership',
    featureCopy: 'Price alerts',
    benefits: ['Exclusive offers']
};

describe('VipGateDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        readPlan.mockResolvedValue(plan);
    });

    it('renders the catalog price in minor units and links to that exact monthly checkout option', async () => {
        const { rerender } = render(<VipGateDialog {...props} />);
        expect(await screen.findByRole('link', { name: 'Hacerme VIP' })).toHaveAttribute(
            'href',
            '/es/suscriptores/checkout/?opcion=monthly-option'
        );
        expect(screen.getByRole('status').textContent).toBe(
            `${formatPrice({ amount: plan.monthlyPriceArs / 100, locale: 'es', showDecimals: true })} por mes`
        );
        readPlan.mockResolvedValue({ ...plan, monthlyPriceArs: 123400 });
        rerender(
            <VipGateDialog
                {...props}
                open={false}
            />
        );
        rerender(<VipGateDialog {...props} />);
        await waitFor(() =>
            expect(screen.getByRole('status').textContent).toBe(
                `${formatPrice({ amount: 1234, locale: 'es' })} por mes`
            )
        );
    });

    it('has a labeled modal and description, traps Tab, and dismisses with Escape or Ahora no', async () => {
        const user = userEvent.setup();
        render(<VipGateDialog {...props} />);
        const dialog = await screen.findByRole('dialog', { name: props.title });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleDescription(props.body);
        await screen.findByRole('link');
        const last = screen.getByRole('link');
        last.focus();
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        expect(last).not.toHaveFocus();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledOnce();
        await user.click(screen.getByRole('button', { name: 'Ahora no' }));
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('never invents a price or checkout on an unavailable catalog', async () => {
        readPlan.mockResolvedValue(null);
        render(<VipGateDialog {...props} />);
        expect(
            await screen.findByText('No pudimos cargar el precio del plan VIP. Volvé a intentarlo.')
        ).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hacerme VIP' })).toBeDisabled();
        readPlan.mockResolvedValue(plan);
        await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByRole('link', { name: 'Hacerme VIP' })).toBeInTheDocument();
    });

    it('does not read the catalog while closed', () => {
        render(
            <VipGateDialog
                {...props}
                open={false}
            />
        );
        expect(readPlan).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
        { locale: 'en' as const, upgrade: 'Become VIP', dismiss: 'Not now', cycle: 'per month' },
        { locale: 'pt' as const, upgrade: 'Quero ser VIP', dismiss: 'Agora não', cycle: 'por mês' }
    ])('renders real $locale translations and a localized checkout', async ({
        locale,
        upgrade,
        dismiss,
        cycle
    }) => {
        render(
            <VipGateDialog
                {...props}
                locale={locale}
            />
        );
        expect(await screen.findByRole('link', { name: upgrade })).toHaveAttribute(
            'href',
            `/${locale}/suscriptores/checkout/?opcion=monthly-option`
        );
        expect(screen.getByRole('button', { name: dismiss })).toBeEnabled();
        expect(screen.getByRole('status')).toHaveTextContent(cycle);
    });
});
