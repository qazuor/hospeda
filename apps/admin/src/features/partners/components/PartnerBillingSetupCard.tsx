import { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { PartnerBillingSetupDialog } from './PartnerBillingSetupDialog';

/** Props for {@link PartnerBillingSetupCard}. AC:V7:17; ACC:6. */
export interface PartnerBillingSetupCardProps {
    /** Partner UUID. AC:V7:17; ACC:6. */
    readonly partnerId: string;
}

/** Shows the action 6 entry point only to users with its dedicated permission. AC:V7:17; ACC:6. */
export function PartnerBillingSetupCard({ partnerId }: PartnerBillingSetupCardProps) {
    const { t } = useTranslations();
    const [open, setOpen] = useState(false);
    return (
        <Card data-testid="partner-billing-setup-card">
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.partnerBillingSetup.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">
                    {t('admin-entities.partnerBillingSetup.state')}
                </p>
                <PermissionGate permissions={[PermissionEnum.PARTNER_CONFIGURE_BILLING]}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(true)}
                    >
                        {t('admin-entities.partnerBillingSetup.configure')}
                    </Button>
                    <PartnerBillingSetupDialog
                        partnerId={partnerId}
                        open={open}
                        onOpenChange={setOpen}
                    />
                </PermissionGate>
            </CardContent>
        </Card>
    );
}
