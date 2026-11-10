import type { TranslationKey } from '@repo/i18n';
import { formatCurrency } from '@repo/i18n';
import type { AdminSubscriptionDetailHttp } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { ApiError } from '@/lib/errors';
import { formatDateWithTime } from '@/lib/format-helpers';
import { useAdminSubscriptionDetail } from '../hooks/useAdminSubscriptionDetail';
import { SubscriptionActionLinks } from './SubscriptionActionLinks';

type Detail = AdminSubscriptionDetailHttp;

const isNotFound = (error: unknown): boolean =>
    error instanceof ApiError && (error.status === 404 || error.code === 'NOT_FOUND');

/**
 * Administrative subscription detail. Shows the owner, plan and version, next
 * charge, open pause and current courtesy, and the action links the current
 * user may open.
 */
export function SubscriptionDetailScreen({ subscriptionId }: { readonly subscriptionId: string }) {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]}>
            <DetailBody subscriptionId={subscriptionId} />
        </PermissionGate>
    );
}

function DetailBody({ subscriptionId }: { readonly subscriptionId: string }) {
    const { t, locale } = useTranslations();
    const query = useAdminSubscriptionDetail({ subscriptionId });

    if (query.isLoading) {
        return (
            <div data-testid="subscription-detail">
                <p>{t('admin-billing.subscriptionAdmin.detail.loading')}</p>
            </div>
        );
    }
    if (query.isError) {
        const notFound = isNotFound(query.error);
        return (
            <div
                data-testid="subscription-detail"
                role="alert"
                className="space-y-2"
            >
                <p>
                    {notFound
                        ? t('admin-billing.subscriptionAdmin.detail.notFound')
                        : t('admin-billing.subscriptionAdmin.detail.error')}
                </p>
                {notFound ? null : (
                    <Button onClick={() => void query.refetch()}>
                        {t('admin-billing.subscriptionAdmin.detail.retry')}
                    </Button>
                )}
            </div>
        );
    }

    const detail = query.data;
    if (!detail) {
        return (
            <div data-testid="subscription-detail">
                <p>{t('admin-billing.subscriptionAdmin.detail.notFound')}</p>
            </div>
        );
    }

    return (
        <div
            data-testid="subscription-detail"
            className="space-y-6"
        >
            <DetailFields
                detail={detail}
                locale={locale}
                t={t}
            />
            <PauseSection
                pause={detail.pause}
                locale={locale}
                t={t}
            />
            <CourtesySection
                courtesy={detail.courtesy}
                locale={locale}
                t={t}
            />
            {detail.succeedsId || detail.succeededById ? (
                <section className="space-y-1">
                    <h2 className="font-semibold">
                        {t('admin-billing.subscriptionAdmin.detail.succession')}
                    </h2>
                    {detail.succeedsId ? (
                        <p>
                            {t('admin-billing.subscriptionAdmin.detail.succeeds')}:{' '}
                            {detail.succeedsId}
                        </p>
                    ) : null}
                    {detail.succeededById ? (
                        <p>
                            {t('admin-billing.subscriptionAdmin.detail.succeededBy')}:{' '}
                            {detail.succeededById}
                        </p>
                    ) : null}
                </section>
            ) : null}
            <SubscriptionActionLinks subscriptionId={subscriptionId} />
        </div>
    );
}

type Translate = (key: TranslationKey, params?: Record<string, unknown>) => string;

function DetailFields({
    detail,
    locale,
    t
}: {
    readonly detail: Detail;
    readonly locale: string;
    readonly t: Translate;
}) {
    const unknown = t('admin-billing.subscriptionAdmin.unknownValue');
    const statusLabel = t(
        `admin-billing.subscriptionAdmin.statuses.${detail.status}` as TranslationKey
    );
    const classLabel = t(
        `admin-billing.subscriptionAdmin.classes.${detail.class}` as TranslationKey
    );

    return (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.owner')}
                value={detail.owner ? detail.owner.email : unknown}
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.name')}
                value={detail.owner?.displayName ?? unknown}
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.status')}
                value={statusLabel}
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.class')}
                value={classLabel}
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.vertical')}
                value={
                    detail.vertical
                        ? t(
                              `admin-billing.subscriptionAdmin.verticals.${detail.vertical}` as TranslationKey
                          )
                        : unknown
                }
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.plan')}
                value={detail.plan?.planName ?? unknown}
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.planVersion')}
                value={planVersionLabel(detail, t, locale)}
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.price')}
                value={priceLabel(detail, t, locale)}
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.nextCharge')}
                value={
                    detail.nextChargeAt
                        ? formatDateWithTime({ date: detail.nextChargeAt, locale })
                        : unknown
                }
            />
            <Field
                label={t('admin-billing.subscriptionAdmin.detail.serviceEndsAt')}
                value={
                    detail.serviceEndsAt
                        ? formatDateWithTime({ date: detail.serviceEndsAt, locale })
                        : unknown
                }
            />
        </dl>
    );
}

function planVersionLabel(detail: Detail, t: Translate, locale: string): string {
    if (!detail.planVersion) return t('admin-billing.subscriptionAdmin.unknownValue');
    const createdAt = formatDateWithTime({ date: detail.planVersion.createdAt, locale });
    const retired = detail.planVersion.sellable
        ? ''
        : ` (${t('admin-billing.subscriptionAdmin.detail.planVersionRetired')})`;
    return (
        t('admin-billing.subscriptionAdmin.detail.planVersionCreatedAt', { date: createdAt }) +
        retired
    );
}

function priceLabel(detail: Detail, t: Translate, locale: string): string {
    if (!detail.price) return t('admin-billing.subscriptionAdmin.unknownValue');
    const amount = formatCurrency({
        value: detail.price.amountMinor / 100,
        currency: detail.price.currency,
        locale
    });
    const cycle = t(
        `admin-billing.subscriptionAdmin.cycles.${detail.price.cycle}` as TranslationKey
    );
    return `${amount} · ${cycle}`;
}

function PauseSection({
    pause,
    locale,
    t
}: {
    readonly pause: Detail['pause'];
    readonly locale: string;
    readonly t: Translate;
}) {
    return (
        <section
            data-testid="subscription-detail-pause"
            className="space-y-1"
        >
            <h2 className="font-semibold">
                {t('admin-billing.subscriptionAdmin.detail.pauseTitle')}
            </h2>
            {pause ? (
                <ul className="space-y-1">
                    <li>
                        {t('admin-billing.subscriptionAdmin.detail.pauseReason')}:{' '}
                        {t(
                            `admin-billing.subscriptionAdmin.pauseReasons.${pause.reason}` as TranslationKey
                        )}
                    </li>
                    <li>
                        {t('admin-billing.subscriptionAdmin.detail.pauseFrom')}:{' '}
                        {formatDateWithTime({ date: pause.startsAt, locale })}
                    </li>
                    <li>
                        {t('admin-billing.subscriptionAdmin.detail.pauseUntil')}:{' '}
                        {pause.expectedEndAt
                            ? formatDateWithTime({ date: pause.expectedEndAt, locale })
                            : t('admin-billing.subscriptionAdmin.detail.pauseNoExpectedEnd')}
                    </li>
                </ul>
            ) : (
                <p>{t('admin-billing.subscriptionAdmin.detail.noPause')}</p>
            )}
        </section>
    );
}

function CourtesySection({
    courtesy,
    locale,
    t
}: {
    readonly courtesy: Detail['courtesy'];
    readonly locale: string;
    readonly t: Translate;
}) {
    return (
        <section
            data-testid="subscription-detail-courtesy"
            className="space-y-1"
        >
            <h2 className="font-semibold">
                {t('admin-billing.subscriptionAdmin.detail.courtesyTitle')}
            </h2>
            {courtesy ? (
                <ul className="space-y-1">
                    <li>
                        {t('admin-billing.subscriptionAdmin.detail.courtesyMonths')}:{' '}
                        {courtesy.months}
                    </li>
                    <li>
                        {t('admin-billing.subscriptionAdmin.detail.courtesyUntil')}:{' '}
                        {formatDateWithTime({ date: courtesy.endsAt, locale })}
                    </li>
                    <li>
                        {t('admin-billing.subscriptionAdmin.detail.courtesyRemaining')}:{' '}
                        {courtesy.remainingMonths}
                    </li>
                </ul>
            ) : (
                <p>{t('admin-billing.subscriptionAdmin.detail.noCourtesy')}</p>
            )}
        </section>
    );
}

function Field({ label, value }: { readonly label: string; readonly value: string }) {
    return (
        <div>
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}
