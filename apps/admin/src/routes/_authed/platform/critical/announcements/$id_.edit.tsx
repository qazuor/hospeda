/**
 * Announcements editor — edit form (SPEC-156 PR-4 T-040).
 *
 * Route: /platform/critical/announcements/$id/edit
 *
 * Loads the current array from announcements.global, finds the row whose
 * `id` matches the route param, seeds the shared <AnnouncementForm> with
 * its values, and on submit REPLACES that row (preserving its id) in the
 * array via useUpdatePlatformSetting.
 *
 * Permission gate: same as the list page — MAINTENANCE_MODE_WRITE
 * (SUPER_ADMIN-only).
 */

import { AnnouncementForm } from '@/features/announcements/AnnouncementForm';
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { usePlatformSetting, useUpdatePlatformSetting } from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { type AnnouncementItem, type AnnouncementsValue, PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/critical/announcements/$id_/edit')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: TanStack Router types `beforeLoad` context as a generic
        // `Record<string, unknown>`; the `_authed` layout injects `AuthState` at runtime
        // but the type system doesn't propagate it to child route guards automatically.
        const authState = context as unknown as AuthState;
        const canWrite = authState.permissions?.includes(PermissionEnum.MAINTENANCE_MODE_WRITE);
        if (!canWrite) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: EditAnnouncementPage
});

function EditAnnouncementPage() {
    const { t } = useTranslations();
    const navigate = useNavigate();
    const { id } = Route.useParams();
    const { success: toastSuccess, error: toastError } = useFlashyToast();

    const query = usePlatformSetting({ key: 'announcements.global' });
    const mutation = useUpdatePlatformSetting({ key: 'announcements.global' });

    const existing: AnnouncementsValue = query.data?.row?.value ?? [];
    const target = existing.find((item) => item.id === id) ?? null;

    if (query.isLoading) {
        return (
            <div className="mx-auto max-w-3xl space-y-6 p-6">
                <div
                    className="h-24 animate-pulse rounded-lg bg-muted"
                    data-testid="edit-announcement-loading"
                />
            </div>
        );
    }

    if (target === null) {
        return (
            <div className="mx-auto max-w-3xl space-y-6 p-6">
                <div data-testid="edit-announcement-missing">
                    <p className="font-medium">{t('admin-pages.announcements.list.empty.title')}</p>
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.announcements.list.empty.description')}
                    </p>
                </div>
            </div>
        );
    }

    const handleSubmit = (item: AnnouncementItem): void => {
        const next: AnnouncementsValue = existing.map((entry) => (entry.id === id ? item : entry));
        mutation.mutate(next, {
            onSuccess: () => {
                toastSuccess(t('admin-pages.announcements.form.editTitle'));
                navigate({ to: '/platform/critical/announcements' });
            },
            onError: () => {
                toastError(t('admin-pages.announcements.form.errorGeneric'));
            }
        });
    };

    return (
        <div
            className="mx-auto max-w-3xl space-y-6 p-6"
            data-testid="edit-announcement-page"
        >
            <div>
                <h2 className="mb-2 font-bold text-2xl">
                    {t('admin-pages.announcements.form.editTitle')}
                </h2>
                <p className="text-muted-foreground">
                    {t('admin-pages.announcements.form.editSubtitle')}
                </p>
            </div>

            <AnnouncementForm
                itemId={target.id}
                submitting={mutation.isPending}
                submitLabel={t('admin-pages.announcements.form.submitEdit')}
                cancelHref="/platform/critical/announcements"
                onSubmit={handleSubmit}
                initial={{
                    textEs: target.text.es,
                    textEn: target.text.en,
                    textPt: target.text.pt,
                    variant: target.variant,
                    dismissible: target.dismissible,
                    startsAt: target.startsAt ?? '',
                    endsAt: target.endsAt ?? ''
                }}
            />
        </div>
    );
}
