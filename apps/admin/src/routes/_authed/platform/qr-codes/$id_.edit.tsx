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
import { tagSelectionChanged } from '@/features/qr-codes/components/QrCodeTagPicker';
import { useQrCodeDetail, useUpdateQrCode } from '@/features/qr-codes/hooks/useQrCodes';
import { useQrCodeTagsOf, useSetQrCodeTags } from '@/features/qr-codes/hooks/useQrCodeTags';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/platform/qr-codes/$id_/edit')({
    component: QrCodeEditPage
});

function QrCodeEditPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: qrCode, isLoading } = useQrCodeDetail(id);
    // HOS-2679: the form opens with the code's current tags, so it waits for
    // them — opening empty and saving would silently clear every tag.
    const { data: currentTags, isLoading: tagsLoading } = useQrCodeTagsOf(id);

    if (isLoading || tagsLoading) {
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
                initialTagIds={(currentTags ?? []).map((tag) => tag.id)}
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
    const setTagsMutation = useSetQrCodeTags();
    const [tagIds, setTagIds] = useState<readonly string[]>(initialTagIds);

    const handleSubmit = async (payload: QrCodeCreateHttp | QrCodeUpdateHttp) => {
        try {
            await updateMutation.mutateAsync({ id, data: payload as QrCodeUpdateHttp });
            if (tagSelectionChanged({ before: initialTagIds, after: tagIds })) {
                await setTagsMutation.mutateAsync({ id, tagIds });
            }
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
