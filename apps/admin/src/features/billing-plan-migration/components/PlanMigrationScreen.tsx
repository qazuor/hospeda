import type { TranslationKey } from '@repo/i18n';
import type { PlanMigrationLaunchResponse, PlanMigrationPreview } from '@repo/schemas';
import { PlanMigrationPreviewRequestSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import {
    useLaunchPlanMigration,
    usePlanMigrationOptions,
    usePreviewPlanMigration
} from '../hooks/usePlanMigration';
import { planVersionLabel } from '../utils/plan-version-label';
import { PlanMigrationConfirm } from './PlanMigrationConfirm';
import { PlanMigrationDetail } from './PlanMigrationDetail';
import { PlanMigrationList } from './PlanMigrationList';
import { PlanMigrationPreviewTable } from './PlanMigrationPreviewTable';
import { RetiredPlanVersions } from './RetiredPlanVersions';

const errorCodes = new Set([
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'INVALID_PLAN_MIGRATION_INPUT',
    'PLAN_VERSION_NOT_FOUND',
    'PLAN_MIGRATION_SOURCE_NOT_RETIRED',
    'PLAN_MIGRATION_TARGET_NOT_SELLABLE',
    'PLAN_MIGRATION_VERTICAL_MISMATCH',
    'PLAN_MIGRATION_SAME_VERSION',
    'PLAN_MIGRATION_COHORT_CHANGED',
    'PLAN_MIGRATION_EMPTY_COHORT',
    'PLAN_MIGRATION_INCREASE_OTHER_PLAN',
    'PLAN_MIGRATION_INCREASE_SOURCE_CURRENT',
    'PLAN_MIGRATION_INCREASE_CYCLE_MISSING'
]);

/** Selects versions, previews every customer, and confirms action 17. */
export function PlanMigrationScreen() {
    const { t, tPlural } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-pages.planMigration.${key}` as TranslationKey, values);
    const options = usePlanMigrationOptions();
    const previewMutation = usePreviewPlanMigration();
    const launch = useLaunchPlanMigration();
    const [preview, setPreview] = useState<PlanMigrationPreview | null>(null);
    const [result, setResult] = useState<PlanMigrationLaunchResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showList, setShowList] = useState(false);
    const [showRetired, setShowRetired] = useState(false);
    const [selectedMigrationId, setSelectedMigrationId] = useState<string | null>(null);
    const errorText = (reason: unknown) => {
        const code = isApiError(reason) ? reason.code : '';
        return errorCodes.has(code) ? tr(`errors.${code}`) : tr('errors.generic');
    };
    const form = useForm({
        defaultValues: {
            sourcePlanVersionId: '',
            targetPlanVersionId: '',
            reason: 'RETIREMENT' as 'RETIREMENT' | 'PRICE_INCREASE'
        },
        onSubmit: async ({ value }) => {
            const parsed = PlanMigrationPreviewRequestSchema.safeParse({
                sourcePlanVersionId: value.sourcePlanVersionId,
                targetPlanVersionId: value.targetPlanVersionId,
                ...(value.reason === 'PRICE_INCREASE' ? { reason: 'PRICE_INCREASE' as const } : {})
            });
            if (!parsed.success) {
                setError(tr('errors.invalidSelection'));
                return;
            }
            setError(null);
            setResult(null);
            setPreview(null);
            try {
                setPreview(await previewMutation.mutateAsync(parsed.data));
            } catch (reason) {
                setError(errorText(reason));
            }
        }
    });
    const confirm = async () => {
        if (!preview?.launchable) return;
        const input = {
            sourcePlanVersionId: preview.source.id,
            targetPlanVersionId: preview.target.id,
            cohortFingerprint: preview.cohortFingerprint,
            ...(preview.reason === 'PRICE_INCREASE' ? { reason: 'PRICE_INCREASE' as const } : {})
        };
        setError(null);
        try {
            setResult(await launch.mutateAsync(input));
        } catch (reason) {
            setError(errorText(reason));
            if (isApiError(reason) && String(reason.code) === 'PLAN_MIGRATION_COHORT_CHANGED') {
                setPreview(null);
                try {
                    setPreview(
                        await previewMutation.mutateAsync({
                            sourcePlanVersionId: input.sourcePlanVersionId,
                            targetPlanVersionId: input.targetPlanVersionId,
                            ...(input.reason ? { reason: input.reason } : {})
                        })
                    );
                } catch (refreshReason) {
                    setError(errorText(refreshReason));
                }
            }
        }
    };
    return (
        <section
            className="space-y-5"
            data-testid="plan-migration-screen"
        >
            <p>{tr('intro')}</p>
            {options.isLoading ? <p role="status">{tr('loading')}</p> : null}
            {options.isError ? <p role="alert">{errorText(options.error)}</p> : null}
            {options.data ? (
                <form
                    className="flex flex-wrap items-end gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                >
                    <form.Field name="reason">
                        {(field) => (
                            <label className="space-y-1 text-sm">
                                {tr('reason')}
                                <select
                                    data-testid="plan-migration-reason"
                                    className="block h-10 min-w-52 rounded-md border bg-background px-3"
                                    value={field.state.value}
                                    onChange={(event) => {
                                        field.handleChange(
                                            event.target.value as 'RETIREMENT' | 'PRICE_INCREASE'
                                        );
                                        form.setFieldValue('sourcePlanVersionId', '');
                                        form.setFieldValue('targetPlanVersionId', '');
                                        setPreview(null);
                                        setResult(null);
                                        setError(null);
                                    }}
                                >
                                    <option value="RETIREMENT">{tr('reasons.RETIREMENT')}</option>
                                    <option value="PRICE_INCREASE">
                                        {tr('reasons.PRICE_INCREASE')}
                                    </option>
                                </select>
                            </label>
                        )}
                    </form.Field>
                    <form.Subscribe selector={(state) => state.values.reason}>
                        {(reason) => {
                            const sources =
                                reason === 'PRICE_INCREASE'
                                    ? options.data.increases.map((pair) => pair.source)
                                    : options.data.sources;
                            return (
                                <>
                                    <form.Field name="sourcePlanVersionId">
                                        {(field) => (
                                            <label className="space-y-1 text-sm">
                                                {tr('source')}
                                                <select
                                                    data-testid="plan-migration-source"
                                                    className="block h-10 min-w-52 rounded-md border bg-background px-3"
                                                    value={field.state.value}
                                                    onChange={(event) => {
                                                        field.handleChange(event.target.value);
                                                        form.setFieldValue(
                                                            'targetPlanVersionId',
                                                            ''
                                                        );
                                                        setPreview(null);
                                                        setResult(null);
                                                        setError(null);
                                                    }}
                                                >
                                                    <option value="">{tr('chooseSource')}</option>
                                                    {sources.map((source) => (
                                                        <option
                                                            key={source.id}
                                                            value={source.id}
                                                        >
                                                            {tPlural(
                                                                'admin-pages.planMigration.sourceOption',
                                                                source.customerCount,
                                                                {
                                                                    name: planVersionLabel({
                                                                        t,
                                                                        name: source.name,
                                                                        versionNumber:
                                                                            source.versionNumber
                                                                    })
                                                                }
                                                            )}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                    </form.Field>
                                    <form.Subscribe
                                        selector={(state) => state.values.sourcePlanVersionId}
                                    >
                                        {(sourceId) => {
                                            const increasePair = options.data.increases.find(
                                                (pair) => pair.source.id === sourceId
                                            );
                                            const source = sources.find(
                                                (item) => item.id === sourceId
                                            );
                                            const targets =
                                                reason === 'PRICE_INCREASE'
                                                    ? increasePair
                                                        ? [increasePair.target]
                                                        : []
                                                    : source
                                                      ? (options.data.targets[source.vertical] ??
                                                        [])
                                                      : [];
                                            return (
                                                <form.Field name="targetPlanVersionId">
                                                    {(field) => (
                                                        <label className="space-y-1 text-sm">
                                                            {tr('target')}
                                                            <select
                                                                data-testid="plan-migration-target"
                                                                className="block h-10 min-w-52 rounded-md border bg-background px-3"
                                                                value={field.state.value}
                                                                onChange={(event) => {
                                                                    field.handleChange(
                                                                        event.target.value
                                                                    );
                                                                    setPreview(null);
                                                                    setResult(null);
                                                                    setError(null);
                                                                }}
                                                            >
                                                                <option value="">
                                                                    {tr('chooseTarget')}
                                                                </option>
                                                                {targets.map((target) => (
                                                                    <option
                                                                        key={target.id}
                                                                        value={target.id}
                                                                    >
                                                                        {planVersionLabel({
                                                                            t,
                                                                            name: target.name,
                                                                            versionNumber:
                                                                                target.versionNumber
                                                                        })}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    )}
                                                </form.Field>
                                            );
                                        }}
                                    </form.Subscribe>
                                </>
                            );
                        }}
                    </form.Subscribe>
                    <Button
                        data-testid="plan-migration-preview-button"
                        type="submit"
                        disabled={previewMutation.isPending}
                    >
                        {tr('preview')}
                    </Button>
                </form>
            ) : null}
            {error ? (
                <p
                    data-testid="plan-migration-error"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
            {preview ? (
                <>
                    <PlanMigrationPreviewTable preview={preview} />
                    <PlanMigrationConfirm
                        preview={preview}
                        pending={launch.isPending}
                        result={result}
                        onConfirm={() => void confirm()}
                    />
                </>
            ) : null}
            <div className="border-t pt-5">
                <Button
                    data-testid="plan-migration-retired-toggle"
                    type="button"
                    variant="outline"
                    onClick={() => setShowRetired((current) => !current)}
                >
                    {tr(showRetired ? 'retiredVersions.hide' : 'retiredVersions.show')}
                </Button>
            </div>
            {showRetired ? <RetiredPlanVersions /> : null}
            <div className="border-t pt-5">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setShowList((current) => !current);
                        setSelectedMigrationId(null);
                    }}
                >
                    {tr(showList ? 'list.hide' : 'list.show')}
                </Button>
            </div>
            {showList ? (
                selectedMigrationId ? (
                    <PlanMigrationDetail
                        id={selectedMigrationId}
                        onClose={() => setSelectedMigrationId(null)}
                    />
                ) : (
                    <PlanMigrationList onSelect={setSelectedMigrationId} />
                )
            ) : null}
        </section>
    );
}
