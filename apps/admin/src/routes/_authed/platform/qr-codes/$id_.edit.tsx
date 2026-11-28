/**
 * Edit a QR code (HOS-981 PR 3).
 *
 * The form is mounted only once the row has loaded, so `useForm` receives the
 * real server values as `defaultValues` on its first render and never needs a
 * reset — the same shape the moderation-terms editor uses.
 */

import {
    PermissionEnum,
    type QrCode,
    type QrCodeCreateHttp,
    type QrCodeUpdateHttp
} from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { useToast } from '@/components/ui/ToastProvider';
import { QrCodeForm } from '@/features/qr-codes/components/QrCodeForm';
import { useQrCodeDetail, useUpdateQrCode } from '@/features/qr-codes/hooks/useQrCodes';
import { useCommitQrCodeTagEdit, useQrCodeTagsOf } from '@/features/qr-codes/hooks/useQrCodeTags';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/platform/qr-codes/$id_/edit')({
    component: QrCodeEditPage
});

function QrCodeEditPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: qrCode, isLoading } = useQrCodeDetail(id);
    // HOS-2679 I2: the form opens with the code's current tags, so it waits for
    // a FRESH read of them (never the cached copy, which may be minutes old) and
    // refuses to open on a failed read — opening with [] would let a save clear
    // every tag. The save itself is a diff against the server's set at save time.
    const tagsQuery = useQrCodeTagsOf(id);

    if (tagsQuery.isError) {
        return (
            <div
                className="p-8 text-destructive"
                role="alert"
            >
                {t('admin-qr-codes.tags.loadError')}
            </div>
        );
    }

    if (isLoading || !tagsQuery.isFetchedAfterMount || !tagsQuery.isSuccess) {
        return <div className="p-8 text-muted-foreground">{t('admin-common.states.loading')}</div>;
    }

    if (!qrCode) {
        return (
            <div className="p-8 text-muted-foreground">{t('admin-qr-codes.messages.notFound')}</div>
        );
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.QR_CODE_UPDATE]}>
            <QrCodeEditForm
                id={id}
                qrCode={qrCode}
                initialTagIds={tagsQuery.data.map((tag) => tag.id)}
            />
        </RoutePermissionGuard>
    );
}

function QrCodeEditForm({
    id,
    qrCode,
    initialTagIds
}: {
    readonly id: string;
    readonly qrCode: QrCode;
    readonly initialTagIds: readonly string[];
}) {
    const { t } = useTranslations();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const updateMutation = useUpdateQrCode();
    const setTagsMutation = useCommitQrCodeTagEdit();
    const [tagIds, setTagIds] = useState<readonly string[]>(initialTagIds);

    const handleSubmit = async (payload: QrCodeCreateHttp | QrCodeUpdateHttp) => {
        try {
            await updateMutation.mutateAsync({ id, data: payload as QrCodeUpdateHttp });
            await setTagsMutation.mutateAsync({ id, before: initialTagIds, after: tagIds });
            addToast({ message: t('admin-qr-codes.messages.updated'), variant: 'success' });
            navigate({ to: '/platform/qr-codes/$id', params: { id } });
        } catch (error) {
            addToast({ message: t('admin-qr-codes.messages.updateError'), variant: 'error' });
            throw error;
        }
    };

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <h1 className="mb-8 font-bold text-3xl">{t('admin-qr-codes.edit')}</h1>
            <QrCodeForm
                mode="edit"
                initialData={qrCode}
                onSubmit={handleSubmit}
                onCancel={() => navigate({ to: '/platform/qr-codes/$id', params: { id } })}
                isSaving={updateMutation.isPending || setTagsMutation.isPending}
                tagIds={tagIds}
                onTagIdsChange={setTagIds}
            />
        </div>
    );
}
