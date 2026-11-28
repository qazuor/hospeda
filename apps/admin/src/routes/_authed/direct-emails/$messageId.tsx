/**
 * @file _authed/direct-emails/$messageId.tsx
 * @description Detail of one sent direct email (HOS-2685): metadata, the message
 * body and the status of every recipient. Permission: DIRECT_EMAIL_VIEW.
 */

import { type DirectEmailRecipientStatusEnum, PermissionEnum } from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { useDirectEmail } from '@/hooks/direct-email';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import { requireDirectEmailPermission } from './-components/direct-email-route-guard';
import { formatDateTime } from './-components/format-date';
import { MessageBody } from './-components/MessageBody';
import { RecipientStatusBadge } from './-components/RecipientStatusBadge';

export const Route = createFileRoute('/_authed/direct-emails/$messageId')({
    beforeLoad: requireDirectEmailPermission({ permission: PermissionEnum.DIRECT_EMAIL_VIEW }),
    component: DirectEmailDetailPage
});

function DirectEmailDetailPage() {
    const { messageId } = Route.useParams();
    const { t, tPlural, locale } = useTranslations();
    const { data, isLoading, error } = useDirectEmail(messageId);

    const notFound = isApiError(error) && error.status === 404;

    return (
        <SidebarPageLayout
            titleKey="admin-direct-email.detail.title"
            actions={
                <Button
                    asChild
                    variant="outline"
                >
                    <Link to="/direct-emails">{t('admin-direct-email.detail.backToList')}</Link>
                </Button>
            }
        >
            {isLoading && <p className="text-muted-foreground text-sm">…</p>}
            {error && (
                <p
                    role="alert"
                    className="text-destructive text-sm"
                >
                    {notFound
                        ? t('admin-direct-email.detail.notFound')
                        : t('admin-direct-email.detail.loadError')}
                </p>
            )}
            {data && (
                <div className="space-y-6">
                    <section className="space-y-3">
                        <h2 className="font-semibold text-xl">{data.subject}</h2>
                        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                            <dt className="text-muted-foreground">
                                {t('admin-direct-email.detail.sentAt')}
                            </dt>
                            <dd>{formatDateTime({ value: data.createdAt, locale })}</dd>
                            <dt className="text-muted-foreground">
                                {t('admin-direct-email.detail.from')}
                            </dt>
                            <dd>{data.fromEmail}</dd>
                            <dt className="text-muted-foreground">
                                {t('admin-direct-email.detail.replyTo')}
                            </dt>
                            <dd>{data.replyToEmail}</dd>
                        </dl>
                    </section>

                    <section className="space-y-3">
                        <h3 className="font-medium text-lg">
                            {tPlural(
                                'admin-direct-email.detail.recipientsTitle',
                                data.recipients.length
                            )}
                        </h3>
                        <div className="overflow-x-auto rounded-lg border bg-card">
                            <table
                                className="w-full text-sm"
                                aria-label={t('admin-direct-email.detail.tableLabel')}
                            >
                                <thead className="bg-muted/50 text-left">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            {t('admin-direct-email.detail.colEmail')}
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            {t('admin-direct-email.detail.colStatus')}
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            {t('admin-direct-email.detail.colSentAt')}
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            {t('admin-direct-email.detail.colDeliveredAt')}
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            {t('admin-direct-email.detail.colOpenedAt')}
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            {t('admin-direct-email.detail.colError')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recipients.map((recipient) => (
                                        <tr
                                            key={recipient.id}
                                            className="border-t"
                                        >
                                            <td className="px-4 py-3">{recipient.email}</td>
                                            <td className="px-4 py-3">
                                                <RecipientStatusBadge
                                                    status={
                                                        recipient.status as DirectEmailRecipientStatusEnum
                                                    }
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatDateTime({
                                                    value: recipient.sentAt,
                                                    locale
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatDateTime({
                                                    value: recipient.deliveredAt,
                                                    locale
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatDateTime({
                                                    value: recipient.openedAt,
                                                    locale
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {recipient.errorMessage ?? ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="font-medium text-lg">
                            {t('admin-direct-email.detail.bodyTitle')}
                        </h3>
                        <MessageBody bodyJson={data.bodyJson} />
                    </section>
                </div>
            )}
        </SidebarPageLayout>
    );
}
