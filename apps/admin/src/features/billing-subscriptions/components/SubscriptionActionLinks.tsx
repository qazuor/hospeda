import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';

type ActionLink = {
    /** Stable key used for the i18n label and the test id. */
    readonly key: 'cancellation' | 'revocation' | 'pause' | 'plan-change' | 'courtesy';
    /** Permission that reveals this link. */
    readonly permission: PermissionEnum;
    /** TanStack Router target for the action page. */
    readonly to:
        | '/billing/subscriptions/$subscriptionId/cancellation'
        | '/billing/subscriptions/$subscriptionId/revocation'
        | '/billing/subscriptions/$subscriptionId/pause'
        | '/billing/subscriptions/$subscriptionId/plan-change'
        | '/billing/subscriptions/$subscriptionId/courtesy';
};

const ACTION_LINKS: readonly ActionLink[] = [
    {
        key: 'cancellation',
        permission: PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
        to: '/billing/subscriptions/$subscriptionId/cancellation'
    },
    {
        key: 'revocation',
        permission: PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
        to: '/billing/subscriptions/$subscriptionId/revocation'
    },
    {
        key: 'pause',
        permission: PermissionEnum.BILLING_PAUSE_SUBSCRIPTION,
        to: '/billing/subscriptions/$subscriptionId/pause'
    },
    {
        key: 'plan-change',
        permission: PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN,
        to: '/billing/subscriptions/$subscriptionId/plan-change'
    },
    {
        key: 'courtesy',
        permission: PermissionEnum.BILLING_GRANT_COMPLIMENTARY,
        to: '/billing/subscriptions/$subscriptionId/courtesy'
    }
];

const ACTION_LABEL_KEYS: Readonly<Record<ActionLink['key'], TranslationKey>> = {
    cancellation: 'admin-billing.subscriptionAdmin.actions.cancellation',
    revocation: 'admin-billing.subscriptionAdmin.actions.revocation',
    pause: 'admin-billing.subscriptionAdmin.actions.pause',
    'plan-change': 'admin-billing.subscriptionAdmin.actions.planChange',
    courtesy: 'admin-billing.subscriptionAdmin.actions.courtesy'
};

/**
 * Renders the five subscription action links, one per permission the current
 * user actually holds. The subscription state never hides a link (Q4): each
 * action screen explains its own eligibility. When no action permission is
 * present, a short notice is shown instead of an empty list.
 *
 * @param props.subscriptionId - UUID shared by every action route.
 */
export function SubscriptionActionLinks({ subscriptionId }: { readonly subscriptionId: string }) {
    const { t } = useTranslations();
    const permissions = useUserPermissions();
    const visible = ACTION_LINKS.filter((action) => permissions.includes(action.permission));

    return (
        <section
            data-testid="subscription-action-links"
            className="space-y-2"
        >
            <h2 className="font-semibold">{t('admin-billing.subscriptionAdmin.actions.title')}</h2>
            {visible.length === 0 ? (
                <p>{t('admin-billing.subscriptionAdmin.actions.noPermissions')}</p>
            ) : (
                <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {visible.map((action) => (
                        <li key={action.key}>
                            <Link
                                to={action.to}
                                params={{ subscriptionId }}
                                data-testid={`subscription-action-${action.key}`}
                                className="underline-offset-4 hover:underline"
                            >
                                {t(ACTION_LABEL_KEYS[action.key])}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
