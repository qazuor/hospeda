/**
 * Create a QR code (HOS-981 PR 3).
 */

import { PermissionEnum, type QrCodeCreateHttp, type QrCodeUpdateHttp } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { useToast } from '@/components/ui/ToastProvider';
import { QrCodeForm } from '@/features/qr-codes/components/QrCodeForm';
import { useCreateQrCode } from '@/features/qr-codes/hooks/useQrCodes';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/platform/qr-codes/new')({
    component: QrCodeCreatePage
});

function QrCodeCreatePage() {
    const { t } = useTranslations();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const createMutation = useCreateQrCode();

    const handleSubmit = async (payload: QrCodeCreateHttp | QrCodeUpdateHttp) => {
        try {
            const created = await createMutation.mutateAsync(payload as never);
            addToast({ message: t('admin-qr-codes.messages.created'), variant: 'success' });
            navigate({ to: '/platform/qr-codes/$id', params: { id: created.id } });
        } catch (_error) {
            addToast({ message: t('admin-qr-codes.messages.createError'), variant: 'error' });
            // Rethrown so the form knows the save did not happen: a submit that
            // neither succeeds nor complains is worse than one that fails loudly.
            throw _error;
        }
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.QR_CODE_CREATE]}>
            <div className="container mx-auto max-w-4xl py-8">
                <h1 className="mb-8 font-bold text-3xl">{t('admin-qr-codes.create')}</h1>
                <QrCodeForm
                    mode="create"
                    onSubmit={handleSubmit}
                    onCancel={() => navigate({ to: '/platform/qr-codes' })}
                    isSaving={createMutation.isPending}
                />
            </div>
        </RoutePermissionGuard>
    );
}
