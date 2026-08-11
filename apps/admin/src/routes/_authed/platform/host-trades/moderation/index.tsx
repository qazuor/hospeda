/**
 * @file _authed/platform/host-trades/moderation/index.tsx
 * @description The host-trade moderation screen (HOS-376 T-055).
 *
 * Two queues on one page, in a fixed order that is itself the point: replies
 * first because they BLOCK — a provider cannot answer a complaint about his own
 * business until one is cleared — and reviews second because they do not. A
 * moderator opening this page should be able to tell, without reading a word,
 * which pile is costing somebody something.
 *
 * Gated on `HOST_TRADE_REVIEW_VIEW_ALL`. Recording a verdict additionally needs
 * `HOST_TRADE_REVIEW_MODERATE`, which the API enforces — a viewer without it
 * sees the queues and gets a 403 on the decision, rather than being kept off a
 * screen they are allowed to read.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { useHostTradePendingCounts } from '@/hooks/use-host-trade-moderation';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { ReplyQueueSection } from './-components/ReplyQueueSection';
import { ReviewQueueSection } from './-components/ReviewQueueSection';

export const Route = createFileRoute('/_authed/platform/host-trades/moderation/')({
    component: HostTradeModerationPage,
    errorComponent: createErrorComponent('HostTradeModeration'),
    pendingComponent: createPendingComponent()
});

/** The host-trade moderation page. */
function HostTradeModerationPage() {
    const { t } = useTranslations();
    const { data: counts } = useHostTradePendingCounts();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL]}>
            <div className="space-y-8 p-6">
                <header className="space-y-1">
                    <h1 className="font-bold text-2xl">{t('host-trades.moderation.title')}</h1>
                    <p className="text-muted-foreground text-sm">
                        {t('host-trades.moderation.subtitle')}
                    </p>

                    {counts ? (
                        // The two numbers are shown SEPARATELY, never their sum:
                        // forty harmless backlog items and forty blocked
                        // providers are the same total and opposite problems.
                        <p className="text-muted-foreground text-sm">
                            {`${t('host-trades.moderation.replies.title')}: ${counts.byType.replies}`}
                            {' · '}
                            {`${t('host-trades.moderation.reviews.title')}: ${counts.byType.reviews}`}
                        </p>
                    ) : null}
                </header>

                <ReplyQueueSection />
                <ReviewQueueSection />
            </div>
        </RoutePermissionGuard>
    );
}
