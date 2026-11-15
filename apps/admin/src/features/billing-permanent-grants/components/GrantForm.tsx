import {
    type PermanentGrantAnchorBody,
    PermanentGrantAnchorBodySchema,
    type PermanentGrantCreateRequest,
    PermanentGrantCreateRequestSchema,
    VerticalEnum
} from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminPlanCatalog } from '@/features/billing-plan-catalog/hooks/usePlanCatalog';
import { useTranslations } from '@/hooks/use-translations';

interface Props {
    userId: string;
    mode: 'grant' | 'anchor';
    onPreview: (body: PermanentGrantCreateRequest | PermanentGrantAnchorBody) => void;
}

export function GrantForm({ userId, mode, onPreview }: Props) {
    const { t } = useTranslations();
    const [vertical, setVertical] = useState<VerticalEnum>(VerticalEnum.ACCOMMODATION);
    const [planId, setPlanId] = useState('');
    const [reason, setReason] = useState('');
    const [includesAddons, setIncludesAddons] = useState(false);
    const [error, setError] = useState(false);
    const catalog = useAdminPlanCatalog({ vertical });
    const plans = catalog.data?.plans.filter((plan) => plan.currentVersion !== null) ?? [];
    const selected = plans.find((plan) => plan.planId === planId);
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        setError(false);
        if (!selected?.currentVersion) {
            setError(true);
            return;
        }
        const anchor = PermanentGrantAnchorBodySchema.safeParse({
            vertical,
            planId: selected.planId,
            floorPlanVersionId: selected.currentVersion.versionId
        });
        if (!anchor.success) {
            setError(true);
            return;
        }
        if (mode === 'anchor') {
            onPreview(anchor.data);
            return;
        }
        const grant = PermanentGrantCreateRequestSchema.safeParse({
            beneficiaryUserId: userId,
            reason,
            includesAddons,
            anchors: [anchor.data]
        });
        if (!grant.success) {
            setError(true);
            return;
        }
        onPreview(grant.data);
    };
    return (
        <form
            onSubmit={submit}
            className="space-y-4"
            data-testid={`permanent-grant-${mode}-form`}
        >
            <div className="space-y-2">
                <Label htmlFor="grant-vertical">
                    {t('admin-billing.permanentGrants.vertical')}
                </Label>
                <select
                    id="grant-vertical"
                    value={vertical}
                    onChange={(event) => {
                        setVertical(event.target.value as VerticalEnum);
                        setPlanId('');
                        setError(false);
                    }}
                    className="w-full rounded-md border p-2"
                    data-testid="permanent-grant-vertical"
                >
                    {Object.values(VerticalEnum).map((value) => (
                        <option
                            key={value}
                            value={value}
                        >
                            {t(
                                `admin-billing.permanentGrants.verticals.${value}` as 'admin-billing.permanentGrants.verticals.accommodation'
                            )}
                        </option>
                    ))}
                </select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="grant-plan">{t('admin-billing.permanentGrants.plan')}</Label>
                <select
                    id="grant-plan"
                    value={planId}
                    onChange={(event) => {
                        setPlanId(event.target.value);
                        setError(false);
                    }}
                    className="w-full rounded-md border p-2"
                    data-testid="permanent-grant-plan"
                >
                    <option value="">{t('admin-billing.permanentGrants.selectPlan')}</option>
                    {plans.map((plan) => (
                        <option
                            key={plan.planId}
                            value={plan.planId}
                        >
                            {plan.name}
                        </option>
                    ))}
                </select>
                {catalog.isError ? (
                    <p role="alert">{t('admin-billing.permanentGrants.catalogError')}</p>
                ) : null}
                {catalog.isSuccess && plans.length === 0 ? (
                    <p>{t('admin-billing.permanentGrants.noPlans')}</p>
                ) : null}
            </div>
            {mode === 'grant' ? (
                <>
                    <label
                        htmlFor="grant-includes-addons"
                        className="flex items-center gap-2"
                    >
                        <Input
                            id="grant-includes-addons"
                            type="checkbox"
                            checked={includesAddons}
                            onChange={(event) => setIncludesAddons(event.target.checked)}
                            className="size-4"
                            data-testid="permanent-grant-includes-addons"
                        />
                        {t('admin-billing.permanentGrants.includesAddons')}
                    </label>
                    <div className="space-y-2">
                        <Label htmlFor="grant-reason">
                            {t('admin-billing.permanentGrants.reason')}
                        </Label>
                        <Input
                            id="grant-reason"
                            value={reason}
                            maxLength={2000}
                            onChange={(event) => {
                                setReason(event.target.value);
                                setError(false);
                            }}
                            data-testid="permanent-grant-reason"
                        />
                    </div>
                </>
            ) : null}
            {error ? <p role="alert">{t('admin-billing.permanentGrants.invalidForm')}</p> : null}
            <Button
                type="submit"
                disabled={!selected || (mode === 'grant' && reason.trim().length === 0)}
                data-testid="permanent-grant-preview-submit"
            >
                {t('admin-billing.permanentGrants.preview')}
            </Button>
        </form>
    );
}
