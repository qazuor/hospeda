import type { AdminPartnerApplicationPanelItem, PartnerApplicationPanelView } from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { usePartnerApplicationActions } from '../hooks/usePartnerApplicationActions';
import { PartnerApplicationActionDialog } from './PartnerApplicationActionDialog';

export function PartnerApplicationRowActions({
    item,
    view
}: {
    readonly item: AdminPartnerApplicationPanelItem;
    readonly view: PartnerApplicationPanelView;
}) {
    const { t } = useTranslations();
    const actions = usePartnerApplicationActions();
    const [action, setAction] = useState<'approve' | 'reject' | 'cancelWait' | null>(null);
    if (view === 'approvedUnclaimed') return null;
    return (
        <div className="flex gap-2">
            {view === 'pending' ? (
                <>
                    <Button
                        type="button"
                        onClick={() => setAction('approve')}
                    >
                        {t('admin-entities.partnerApplicationPanel.actions.approve')}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setAction('reject')}
                    >
                        {t('admin-entities.partnerApplicationPanel.actions.reject')}
                    </Button>
                </>
            ) : (
                <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setAction('cancelWait')}
                >
                    {t('admin-entities.partnerApplicationPanel.actions.cancelWait')}
                </Button>
            )}
            {action && (
                <PartnerApplicationActionDialog
                    item={item}
                    action={action}
                    onClose={() => setAction(null)}
                    actions={actions}
                />
            )}
        </div>
    );
}
