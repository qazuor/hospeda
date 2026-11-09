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
import { PlanMigrationConfirm } from './PlanMigrationConfirm';
import { PlanMigrationPreviewTable } from './PlanMigrationPreviewTable';

const errorCodes = new Set([
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'INVALID_PLAN_MIGRATION_INPUT',
    'PLAN_VERSION_NOT_FOUND',
    'PLAN_MIGRATION_SOURCE_NOT_RETIRED',
    'PLAN_MIGRATION_TARGET_NOT_SELLABLE',
    'PLAN_MIGRATION_VERTICAL_MISMATCH',
    'PLAN_MIGRATION_SAME_VERSION',
    'PLAN_MIGRATION_COHORT_CHANGED',
    'PLAN_MIGRATION_EMPTY_COHORT'
]);

/** Selects versions, previews every customer, and confirms action 17. */
export function PlanMigrationScreen() {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-pages.planMigration.${key}` as TranslationKey, values);
    const options = usePlanMigrationOptions();
    const previewMutation = usePreviewPlanMigration();
    const launch = useLaunchPlanMigration();
    const [preview, setPreview] = useState<PlanMigrationPreview | null>(null);
    const [result, setResult] = useState<PlanMigrationLaunchResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const errorText = (reason: unknown) => {
        const code = isApiError(reason) ? reason.code : '';
        return errorCodes.has(code) ? tr(`errors.${code}`) : tr('errors.generic');
    };
    const form = useForm({
        defaultValues: { sourcePlanVersionId: '', targetPlanVersionId: '' },
        onSubmit: async ({ value }) => {
            const parsed = PlanMigrationPreviewRequestSchema.safeParse(value);
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
            cohortFingerprint: preview.cohortFingerprint
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
                            targetPlanVersionId: input.targetPlanVersionId
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
                                        form.setFieldValue('targetPlanVersionId', '');
                                        setPreview(null);
                                        setResult(null);
                                        setError(null);
                                    }}
                                >
                                    <option value="">{tr('chooseSource')}</option>
                                    {options.data.sources.map((source) => (
                                        <option
                                            key={source.id}
                                            value={source.id}
                                        >
                                            {tr('sourceOption', {
                                                name: source.name,
                                                count: source.customerCount
                                            })}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </form.Field>
                    <form.Subscribe selector={(state) => state.values.sourcePlanVersionId}>
                        {(sourceId) => {
                            const source = options.data.sources.find(
                                (item) => item.id === sourceId
                            );
                            const targets = source
                                ? (options.data.targets[source.vertical] ?? [])
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
                                                    field.handleChange(event.target.value);
                                                    setPreview(null);
                                                    setResult(null);
                                                    setError(null);
                                                }}
                                            >
                                                <option value="">{tr('chooseTarget')}</option>
                                                {targets.map((target) => (
                                                    <option
                                                        key={target.id}
                                                        value={target.id}
                                                    >
                                                        {target.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                </form.Field>
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
        </section>
    );
}
