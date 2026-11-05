// @vitest-environment jsdom
import esAdminEntities from '@repo/i18n/locales/es/admin-entities.json';
import { PermissionEnum } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { PartnerBillingSetupCard } from '../PartnerBillingSetupCard';

const mocks = vi.hoisted(() => ({ permissions: [] as string[], mutateAsync: vi.fn() }));
const preview = {
    data: {
        partner: { id: '27f9b37c-8d07-4f93-8340-6819e8740517', name: 'Socio de prueba' },
        ownerUserId: '20b9b37c-8d07-4f93-8340-6819e8740517',
        method: 'MANUAL' as const,
        options: [
            {
                billingOptionId: '31b9b37c-8d07-4f93-8340-6819e8740517',
                planVersionId: '40b9b37c-8d07-4f93-8340-6819e8740517',
                planName: 'Silver',
                planSlug: 'partner-silver',
                cycle: 'monthly' as const,
                amountMinor: 120000,
                currency: 'ARS'
            }
        ],
        effect: 'Creates a subscription pending authorization and opens its first installment.' as const
    },
    isLoading: false,
    isError: false
};
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => mocks.permissions }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string) =>
            key
                .split('.')
                .slice(1)
                .reduce<unknown>(
                    (value, part) =>
                        typeof value === 'object' && value !== null
                            ? (value as Record<string, unknown>)[part]
                            : undefined,
                    esAdminEntities as unknown
                ) as string
    })
}));
vi.mock('../../hooks/usePartnerBillingSetup', () => ({
    usePartnerBillingSetupPreview: () => preview,
    usePartnerBillingSetupMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
    partnerBillingSetupErrorKey: () => 'admin-entities.partnerBillingSetup.errors.commitmentTaken',
    formatPartnerBillingSetupAmount: (option: { amountMinor: number; currency: string }) =>
        `${option.amountMinor} ${option.currency}`,
    partnerBillingSetupCycleKey: (cycle: string) =>
        `admin-entities.partnerBillingSetup.cycle.${cycle}`
}));

describe('PartnerBillingSetupCard', () => {
    beforeEach(() => {
        mocks.permissions = [PermissionEnum.PARTNER_CONFIGURE_BILLING];
        mocks.mutateAsync.mockReset().mockResolvedValue({ created: true });
    });

    it('shows the action to a permitted user and requires an option and a nonblank reason', async () => {
        render(<PartnerBillingSetupCard partnerId={preview.data.partner.id} />);
        expect(screen.getByText('Plan y pago del Partner')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Configurar plan y pago' }));
        const review = screen.getByRole('button', { name: 'Revisar' });
        expect(review).toBeDisabled();
        fireEvent.click(screen.getByRole('radio'));
        expect(screen.getByRole('radio')).toBeChecked();
        expect(review).toBeDisabled();
        const reason = screen.getByLabelText('Motivo');
        await userEvent.type(reason, '   ');
        expect(review).toBeDisabled();
        await userEvent.clear(reason);
        await userEvent.type(reason, 'Alta de plan acordada');
        expect(review).toBeEnabled();
    });

    it('reviews without writing, then confirms with the explicit request body', async () => {
        render(<PartnerBillingSetupCard partnerId={preview.data.partner.id} />);
        await userEvent.click(screen.getByRole('button', { name: 'Configurar plan y pago' }));
        fireEvent.click(screen.getByRole('radio'));
        await userEvent.type(screen.getByLabelText('Motivo'), ' Alta acordada ');
        await userEvent.click(screen.getByRole('button', { name: 'Revisar' }));
        expect(screen.getByTestId('partner-billing-setup-confirmation')).toHaveTextContent(
            'Socio de prueba'
        );
        expect(screen.getByTestId('partner-billing-setup-confirmation')).toHaveTextContent(
            'Manual'
        );
        expect(mocks.mutateAsync).toHaveBeenCalledTimes(0);
        await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
        expect(mocks.mutateAsync).toHaveBeenCalledWith({
            billingOptionId: preview.data.options[0]!.billingOptionId,
            reason: 'Alta acordada',
            confirm: true
        });
    });

    it('renders no action buttons without the dedicated permission', () => {
        mocks.permissions = [PermissionEnum.PARTNER_MANAGE];
        render(<PartnerBillingSetupCard partnerId={preview.data.partner.id} />);
        expect(screen.getByText('Plan y pago del Partner')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows the translated conflict message for a 409', async () => {
        mocks.mutateAsync.mockRejectedValueOnce(new ApiError('Conflict', { status: 409 }));
        render(<PartnerBillingSetupCard partnerId={preview.data.partner.id} />);
        await userEvent.click(screen.getByRole('button', { name: 'Configurar plan y pago' }));
        fireEvent.click(screen.getByRole('radio'));
        await userEvent.type(screen.getByLabelText('Motivo'), 'Alta acordada');
        await userEvent.click(screen.getByRole('button', { name: 'Revisar' }));
        await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'El dueño ya tiene una suscripción incompatible.'
        );
    });
});
