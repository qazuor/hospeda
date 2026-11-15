// @vitest-environment jsdom
import esAdminEntities from '@repo/i18n/locales/es/admin-entities.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { partnerQueryKeys } from '../../hooks/usePartnerQuery';
import { PartnerPresenceModerationCard } from '../PartnerPresenceModerationCard';

const mocks = vi.hoisted(() => ({ permissions: [] as string[], mutateAsync: vi.fn() }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => mocks.permissions }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/features/partners/hooks/usePartnerPresenceModerationMutation', () => ({
    usePartnerPresenceModerationMutation: () => ({
        mutateAsync: mocks.mutateAsync,
        isPending: false
    })
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => {
            let node: unknown = esAdminEntities;
            for (const part of key.replace(/^admin-entities\./, '').split('.')) {
                node =
                    typeof node === 'object' && node !== null
                        ? (node as Record<string, unknown>)[part]
                        : undefined;
            }
            return typeof node === 'string' ? node : key;
        }
    })
}));

describe('PartnerPresenceModerationCard', () => {
    beforeEach(() => {
        mocks.permissions = [PermissionEnum.LISTING_MODERATE];
        mocks.mutateAsync
            .mockReset()
            .mockResolvedValue({ id: 'partner-id', presenceModerated: true });
    });

    it('shows visible state first and requires a non-whitespace reason before moderating', async () => {
        render(
            <PartnerPresenceModerationCard
                partnerId="partner-id"
                presenceModerated={false}
            />
        );
        expect(screen.getByText('Visible si el plan del socio la incluye')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Moderar presencia' }));
        const reason = screen.getByLabelText('Motivo');
        const confirm = screen.getByRole('button', { name: 'Confirmar' });
        expect(confirm).toBeDisabled();
        await userEvent.type(reason, '   ');
        expect(confirm).toBeDisabled();
        await userEvent.clear(reason);
        await userEvent.type(reason, 'Contenido no permitido');
        expect(confirm).toBeEnabled();
        await userEvent.click(confirm);
        await waitFor(() =>
            expect(mocks.mutateAsync).toHaveBeenCalledWith({
                action: 'MODERATE',
                reason: 'Contenido no permitido'
            })
        );
    });

    it('lifts an existing moderation', async () => {
        render(
            <PartnerPresenceModerationCard
                partnerId="partner-id"
                presenceModerated
            />
        );
        await userEvent.click(screen.getByRole('button', { name: 'Levantar moderación' }));
        await userEvent.type(screen.getByLabelText('Motivo'), 'Revisión aprobada');
        await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
        await waitFor(() =>
            expect(mocks.mutateAsync).toHaveBeenCalledWith({
                action: 'LIFT',
                reason: 'Revisión aprobada'
            })
        );
    });

    it('shows the state but no moderation action without LISTING_MODERATE', () => {
        mocks.permissions = [PermissionEnum.PARTNER_MANAGE];
        render(
            <PartnerPresenceModerationCard
                partnerId="partner-id"
                presenceModerated={false}
            />
        );
        expect(screen.getByText('Visible si el plan del socio la incluye')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Moderar presencia' })).not.toBeInTheDocument();
    });

    it('shows the specific message for a 409 no-op response', async () => {
        mocks.mutateAsync.mockRejectedValueOnce(new ApiError('Conflict', { status: 409 }));
        render(
            <PartnerPresenceModerationCard
                partnerId="partner-id"
                presenceModerated={false}
            />
        );
        await userEvent.click(screen.getByRole('button', { name: 'Moderar presencia' }));
        await userEvent.type(screen.getByLabelText('Motivo'), 'Motivo');
        await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'La presencia ya estaba en ese estado. Recargá la página.'
        );
    });

    it('invalidates the Partner detail query after a successful mutation', async () => {
        vi.doUnmock('@/features/partners/hooks/usePartnerPresenceModerationMutation');
        const { usePartnerPresenceModerationMutation } = await import(
            '../../hooks/usePartnerPresenceModerationMutation'
        );
        const client = new QueryClient();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce({
            data: {
                success: true,
                data: { id: '27f9b37c-8d07-4f93-8340-6819e8740517', presenceModerated: true }
            },
            status: 200
        });
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const { result } = renderHook(
            () => usePartnerPresenceModerationMutation('27f9b37c-8d07-4f93-8340-6819e8740517'),
            { wrapper }
        );
        await result.current.mutateAsync({ action: 'MODERATE', reason: 'Approved reason' });
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({
                queryKey: partnerQueryKeys.detail('27f9b37c-8d07-4f93-8340-6819e8740517')
            })
        );
        client.clear();
        vi.restoreAllMocks();
    });
});
