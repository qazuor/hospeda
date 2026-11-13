import type { TranslationKey } from '@repo/i18n';
import type { AdminCatalogPlan, PublishedPlanVersion } from '@repo/schemas';
import { VerticalEnum } from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { useAdminPlanCatalog } from '../hooks/usePlanCatalog';
import { CreatePlanDialog } from './CreatePlanDialog';
import { PlanVersionForm } from './PlanVersionForm';

/** Lists a selected vertical's plans and opens inline create/version editors. */
export function PlanCatalogScreen() {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(key as TranslationKey, values);
    const root = 'admin-billing.planCatalogEditor.';
    const [vertical, setVertical] = useState<VerticalEnum>(VerticalEnum.ACCOMMODATION);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const catalog = useAdminPlanCatalog({ vertical });
    const error =
        catalog.error && isApiError(catalog.error) && catalog.error.status === 403
            ? tr(`${root}errors.forbidden`)
            : tr(`${root}errors.load`);
    const onPublished = (version: PublishedPlanVersion) => {
        setSuccess(tr(`${root}published`, { id: version.id }));
        setEditingPlanId(null);
    };
    const columns = [
        'plan',
        'role',
        'rank',
        'sellable',
        'trialDays',
        'graceDays',
        'allowsPause',
        'inheritsTouristVip',
        'entitlements',
        'limits',
        'cycles',
        'actions'
    ] as const;
    return (
        <section
            className="space-y-5"
            data-testid="plan-catalog-screen"
        >
            <p>{tr(`${root}intro`)}</p>
            <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="space-y-1 text-sm">
                    {tr(`${root}vertical`)}
                    <select
                        data-testid="plan-catalog-vertical"
                        className="h-10 min-w-52 rounded-md border bg-background px-3"
                        value={vertical}
                        onChange={(event) => {
                            setVertical(event.target.value as VerticalEnum);
                            setEditingPlanId(null);
                            setSuccess(null);
                        }}
                    >
                        {Object.values(VerticalEnum).map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {value}
                            </option>
                        ))}
                    </select>
                </label>
                <Button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                >
                    {tr(`${root}actions.createPlan`)}
                </Button>
            </div>
            {success ? <p role="status">{success}</p> : null}
            {catalog.isLoading ? <p>{tr(`${root}loading`)}</p> : null}
            {catalog.isError ? <p role="alert">{error}</p> : null}
            {catalog.data && catalog.data.plans.length === 0 ? <p>{tr(`${root}empty`)}</p> : null}
            {catalog.data && catalog.data.plans.length > 0 ? (
                <div className="overflow-x-auto">
                    <table
                        data-testid="plan-catalog-table"
                        className="w-full min-w-[1100px] border-collapse text-sm"
                    >
                        <thead>
                            <tr>
                                {columns.map((column) => (
                                    <th
                                        key={column}
                                        className="border-b p-2 text-left"
                                    >
                                        {tr(`${root}columns.${column}`)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {catalog.data.plans.map((plan) => (
                                <PlanRow
                                    key={plan.planId}
                                    plan={plan}
                                    editing={editingPlanId === plan.planId}
                                    onEdit={() => {
                                        setSuccess(null);
                                        setEditingPlanId(plan.planId);
                                    }}
                                    onCancel={() => setEditingPlanId(null)}
                                    onPublished={onPublished}
                                    tr={tr}
                                    root={root}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
            <CreatePlanDialog
                open={createOpen}
                vertical={vertical}
                onOpenChange={setCreateOpen}
                onCreated={() => {
                    setSuccess(tr(`${root}createPlan.created`));
                }}
            />
        </section>
    );
}

function PlanRow({
    plan,
    editing,
    onEdit,
    onCancel,
    onPublished,
    tr,
    root
}: {
    readonly plan: AdminCatalogPlan;
    readonly editing: boolean;
    readonly onEdit: () => void;
    readonly onCancel: () => void;
    readonly onPublished: (version: PublishedPlanVersion) => void;
    readonly tr: (key: string, values?: Record<string, string | number>) => string;
    readonly root: string;
}) {
    const current = plan.currentVersion;
    const role = plan.role ? tr(`${root}roles.${plan.role}`) : tr(`${root}roles.none`);
    const bool = (value: boolean) => tr(`${root}${value ? 'yes' : 'no'}`);
    return (
        <>
            <tr data-testid={`plan-row-${plan.planId}`}>
                <td className="border-b p-2">{plan.name}</td>
                <td className="border-b p-2">{role}</td>
                <td className="border-b p-2">{current?.rank ?? tr(`${root}noCurrentVersion`)}</td>
                <td className="border-b p-2">
                    {current ? bool(current.sellable) : tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    {current?.trialDays ?? tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    {current?.graceDays ?? tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    {current ? bool(current.allowsPause) : tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    {current ? bool(current.inheritsTouristVip) : tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    {current?.entitlements.length ?? tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    {current?.limits.length ?? tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    {current
                        ? current.cycles.map((cycle) => tr(`${root}cycles.${cycle}`)).join(', ')
                        : tr(`${root}noCurrentVersion`)}
                </td>
                <td className="border-b p-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onEdit}
                    >
                        {tr(`${root}actions.publish`)}
                    </Button>
                </td>
            </tr>
            {editing ? (
                <tr>
                    <td
                        colSpan={12}
                        className="p-2"
                    >
                        <PlanVersionForm
                            plan={plan}
                            onCancel={onCancel}
                            onPublished={onPublished}
                        />
                    </td>
                </tr>
            ) : null}
        </>
    );
}
