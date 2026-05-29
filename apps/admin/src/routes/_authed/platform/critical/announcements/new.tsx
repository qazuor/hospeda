/**
 * Announcements editor — create form (SPEC-156 PR-4 T-039).
 *
 * Route: /platform/critical/announcements/new
 *
 * Generates a fresh UUID, mounts the shared <AnnouncementForm>, and on
 * submit appends the new item to the announcements.global array via
 * useUpdatePlatformSetting. Existing items are preserved.
 *
 * Permission gate: same as the list page — MAINTENANCE_MODE_WRITE
 * (SUPER_ADMIN-only). Lower roles redirect to /auth/forbidden.
 */

import { AnnouncementForm } from '@/features/announcements/AnnouncementForm';
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { usePlatformSetting, useUpdatePlatformSetting } from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { type AnnouncementItem, type AnnouncementsValue, PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';

export const Route = createFileRoute('/_authed/platform/critical/announcements/new')({
    beforeLoad: ({ context }) => {
        const authState = context as unknown as AuthState;
        const canWrite = authState.permissions?.includes(PermissionEnum.MAINTENANCE_MODE_WRITE);
        if (!canWrite) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: NewAnnouncementPage
});

function NewAnnouncementPage() {
    const { t } = useTranslations();
    const navigate = useNavigate();
    const { success: toastSuccess, error: toastError } = useFlashyToast();

    const query = usePlatformSetting({ key: 'announcements.global' });
    const mutation = useUpdatePlatformSetting({ key: 'announcements.global' });

    // crypto.randomUUID() is available in every browser that the admin
    // supports + in the jsdom test environment, so no polyfill is needed.
    // We memoize so React reruns do not regenerate the id between renders.
    const newId = useMemo(() => crypto.randomUUID(), []);

    const existing: AnnouncementsValue = query.data?.row?.value ?? [];

    const handleSubmit = (item: AnnouncementItem): void => {
        const next: AnnouncementsValue = [...existing, item];
        mutation.mutate(next, {
            onSuccess: () => {
                toastSuccess(t('admin-pages.announcements.list.newAnnouncement'));
                navigate({ to: '/platform/critical/announcements' });
            },
            onError: () => {
                toastError(t('admin-pages.announcements.form.errorGeneric'));
            }
        });
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <div>
                <h2 className="mb-2 font-bold text-2xl">
                    {t('admin-pages.announcements.form.createTitle')}
                </h2>
                <p className="text-muted-foreground">
                    {t('admin-pages.announcements.form.createSubtitle')}
                </p>
            </div>

            <AnnouncementForm
                itemId={newId}
                submitting={mutation.isPending}
                submitLabel={t('admin-pages.announcements.form.submitCreate')}
                cancelHref="/platform/critical/announcements"
                onSubmit={handleSubmit}
            />
        </div>
    );
}
