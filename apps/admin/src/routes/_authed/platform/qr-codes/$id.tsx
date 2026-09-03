/**
 * QR-code detail (HOS-981 PR 3).
 *
 * Shows the symbol next to what it encodes. The two are worth seeing together:
 * the image goes on paper and the URL under it never changes, while the
 * destination beside it is the part an operator is free to move.
 */

import { PermissionEnum, QrCodeFormatEnum } from '@repo/schemas';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/ToastProvider';
import {
    useDeleteQrCode,
    useDownloadQrCode,
    useQrCodeDetail,
    useQrCodePreview
} from '@/features/qr-codes/hooks/useQrCodes';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/platform/qr-codes/$id')({
    component: QrCodeDetailPage
});

function QrCodeDetailPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const { data: qrCode, isLoading } = useQrCodeDetail(id);
    const { data: preview } = useQrCodePreview(id);
    const downloadMutation = useDownloadQrCode();
    const deleteMutation = useDeleteQrCode();

    /**
     * Fetches the image and hands it to the browser as a file.
     *
     * The anchor is created and clicked rather than rendered because the
     * download endpoint is authenticated: a static `href` would have the browser
     * fetch it without the session, and the operator would save a JSON error.
     */
    const handleDownload = async (format: QrCodeFormatEnum) => {
        try {
            const result = await downloadMutation.mutateAsync({ id, format });
            const anchor = document.createElement('a');
            anchor.href = result.dataUrl;
            anchor.download = result.filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        } catch {
            addToast({ message: t('qr-codes.download.failed'), variant: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(t('qr-codes.messages.deleteConfirm'))) return;
        try {
            await deleteMutation.mutateAsync(id);
            addToast({ message: t('qr-codes.messages.deleted'), variant: 'success' });
            navigate({ to: '/platform/qr-codes' });
        } catch {
            addToast({ message: t('qr-codes.messages.deleteError'), variant: 'error' });
        }
    };

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">{t('admin-common.states.loading')}</div>;
    }

    if (!qrCode) {
        return <div className="p-8 text-muted-foreground">{t('qr-codes.messages.notFound')}</div>;
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SETTINGS_MANAGE]}>
            <div className="container mx-auto max-w-4xl py-8">
                <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-bold text-3xl">{qrCode.label}</h1>
                        <p className="font-mono text-muted-foreground">{qrCode.slug}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button asChild>
                            <Link
                                to="/platform/qr-codes/$id/edit"
                                params={{ id: qrCode.id }}
                            >
                                {t('qr-codes.actions.edit')}
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            asChild
                        >
                            <Link to="/platform/qr-codes">{t('qr-codes.actions.backToList')}</Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('qr-codes.detail')}</CardTitle>
                            <CardDescription>{qrCode.description || '—'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <div className="font-medium">{t('qr-codes.columns.targetUrl')}</div>
                                <div className="break-all text-muted-foreground">
                                    {qrCode.targetUrl}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>{t('qr-codes.columns.isActive')}</span>
                                <Badge variant={qrCode.isActive ? 'success' : 'secondary'}>
                                    {qrCode.isActive
                                        ? t('qr-codes.status.active')
                                        : t('qr-codes.status.inactive')}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>{t('qr-codes.columns.source')}</span>
                                <span className="text-muted-foreground">
                                    {t(`qr-codes.source.${qrCode.source}`)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>{t('qr-codes.columns.createdAt')}</span>
                                <span className="text-muted-foreground">
                                    {new Date(qrCode.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('qr-codes.download.title')}</CardTitle>
                            <CardDescription>{t('qr-codes.download.help')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {preview?.dataUrl ? (
                                <img
                                    src={preview.dataUrl}
                                    alt={qrCode.label}
                                    className="h-48 w-48 border bg-white"
                                />
                            ) : null}

                            {preview?.scanUrl ? (
                                <div className="text-sm">
                                    <div className="font-medium">
                                        {t('qr-codes.download.scanUrl')}
                                    </div>
                                    <div className="break-all font-mono text-muted-foreground">
                                        {preview.scanUrl}
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={downloadMutation.isPending}
                                    onClick={() => handleDownload(QrCodeFormatEnum.SVG)}
                                >
                                    {t('qr-codes.download.svg')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={downloadMutation.isPending}
                                    onClick={() => handleDownload(QrCodeFormatEnum.PNG)}
                                >
                                    {t('qr-codes.download.png')}
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={deleteMutation.isPending}
                                    onClick={handleDelete}
                                >
                                    {t('qr-codes.actions.delete')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </RoutePermissionGuard>
    );
}
