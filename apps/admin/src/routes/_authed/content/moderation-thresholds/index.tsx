import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MODERATION_EXAMPLE_CONTEXTS } from '@/features/content-moderation/config/moderation-thresholds.config';
import {
    useModerationThresholdsList,
    useUpdateModerationThreshold
} from '@/features/content-moderation/hooks/useModerationThresholdQuery';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { fetchApi } from '@/lib/api/client';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, updateContentModerationThresholdSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/content/moderation-thresholds/')({
    component: ModerationThresholdsPage,
    errorComponent: createErrorComponent('ModerationThreshold'),
    pendingComponent: createPendingComponent()
});

type ResolvedThreshold = {
    context: string;
    pending: number;
    reject: number;
    source: 'row' | 'default-row' | 'code-constants';
};

function ModerationThresholdsPage() {
    const { t } = useTranslations();
    const { data: listData, isLoading } = useModerationThresholdsList({ page: 1, pageSize: 100 });
    const [resolvedThresholds, setResolvedThresholds] = useState<ResolvedThreshold[]>([]);
    const [resolvedLoading, setResolvedLoading] = useState(false);

    const thresholds = listData?.data ?? [];
    const defaultRow = thresholds.find((th: { context: string }) => th.context === 'default');

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">{t('admin-common.states.loading')}</div>;
    }

    if (!defaultRow) {
        return (
            <div className="p-8 text-muted-foreground">
                {t('content-moderation.thresholds.title')}
            </div>
        );
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_THRESHOLD_VIEW]}>
            <ModerationThresholdsForm
                defaultRow={defaultRow}
                resolvedThresholds={resolvedThresholds}
                setResolvedThresholds={setResolvedThresholds}
                resolvedLoading={resolvedLoading}
                setResolvedLoading={setResolvedLoading}
                t={t}
            />
        </RoutePermissionGuard>
    );
}

type DefaultRow = {
    id: string;
    pending: number;
    reject: number;
};

interface ModerationThresholdsFormProps {
    readonly defaultRow: DefaultRow;
    readonly resolvedThresholds: ResolvedThreshold[];
    readonly setResolvedThresholds: (v: ResolvedThreshold[]) => void;
    readonly resolvedLoading: boolean;
    readonly setResolvedLoading: (v: boolean) => void;
    readonly t: ReturnType<typeof useTranslations>['t'];
}

/**
 * Inner form — only mounts once `defaultRow` is defined,
 * so `useForm` always receives the real server values as `defaultValues`.
 */
function ModerationThresholdsForm({
    defaultRow,
    resolvedThresholds,
    setResolvedThresholds,
    resolvedLoading,
    setResolvedLoading,
    t
}: ModerationThresholdsFormProps) {
    const updateMutation = useUpdateModerationThreshold();
    const canUpdate = useHasPermission(PermissionEnum.MODERATION_THRESHOLD_UPDATE);

    const form = useForm({
        defaultValues: {
            pending: defaultRow.pending,
            reject: defaultRow.reject
        },
        onSubmit: async ({ value }) => {
            const validation = updateContentModerationThresholdSchema.safeParse(value);
            if (!validation.success) return;
            await updateMutation.mutateAsync({ id: defaultRow.id, data: validation.data });
            void fetchResolvedThresholds();
        }
    });

    const fetchResolvedThresholds = async () => {
        setResolvedLoading(true);
        try {
            const results = await Promise.all(
                MODERATION_EXAMPLE_CONTEXTS.map(async (context) => {
                    const response = await fetchApi({
                        path: `/api/v1/admin/content-moderation/thresholds/resolved?context=${context}`
                    });
                    return response.data as ResolvedThreshold;
                })
            );
            setResolvedThresholds(results);
        } catch {
            // silently ignore — resolved panel is informational
        } finally {
            setResolvedLoading(false);
        }
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: fetchResolvedThresholds is stable
    useEffect(() => {
        fetchResolvedThresholds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-bold text-2xl">{t('content-moderation.thresholds.title')}</h1>
                <p className="text-muted-foreground">
                    {t('content-moderation.thresholds.description')}
                </p>
            </div>

            {/* Default row edit form */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('content-moderation.thresholds.title')}</CardTitle>
                    <CardDescription>
                        Context: <code>default</code> —{' '}
                        {t('content-moderation.thresholds.fields.context')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                        className="space-y-4"
                    >
                        <form.Field name="pending">
                            {(field) => (
                                <div className="space-y-1">
                                    <label
                                        className="font-medium text-sm"
                                        htmlFor="pending"
                                    >
                                        {t('content-moderation.thresholds.form.pendingLabel')}
                                    </label>
                                    <Input
                                        id="pending"
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={field.state.value}
                                        disabled={!canUpdate}
                                        onChange={(e) => field.handleChange(Number(e.target.value))}
                                        onBlur={field.handleBlur}
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        {t('content-moderation.thresholds.form.pendingHelp')}
                                    </p>
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {field.state.meta.errors.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="reject">
                            {(field) => (
                                <div className="space-y-1">
                                    <label
                                        className="font-medium text-sm"
                                        htmlFor="reject"
                                    >
                                        {t('content-moderation.thresholds.form.rejectLabel')}
                                    </label>
                                    <Input
                                        id="reject"
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={field.state.value}
                                        disabled={!canUpdate}
                                        onChange={(e) => field.handleChange(Number(e.target.value))}
                                        onBlur={field.handleBlur}
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        {t('content-moderation.thresholds.form.rejectHelp')}
                                    </p>
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {field.state.meta.errors.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        {/* Cross-field validation: pending must be < reject */}
                        <form.Subscribe
                            selector={(state) => ({
                                pending: state.values.pending,
                                reject: state.values.reject
                            })}
                        >
                            {({ pending, reject }) =>
                                pending >= reject ? (
                                    <p className="text-destructive text-xs">
                                        {t(
                                            'content-moderation.thresholds.messages.pendingGteReject'
                                        )}
                                    </p>
                                ) : null
                            }
                        </form.Subscribe>

                        {canUpdate && (
                            <Button
                                type="submit"
                                disabled={updateMutation.isPending}
                            >
                                {updateMutation.isPending
                                    ? t('admin-entities.messages.saving')
                                    : t('admin-entities.actions.save')}
                            </Button>
                        )}
                    </form>
                </CardContent>
            </Card>

            {/* Effective bar per context panel */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('content-moderation.thresholds.resolved.title')}</CardTitle>
                    <CardDescription>
                        {t('content-moderation.thresholds.resolved.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {resolvedLoading ? (
                        <p className="text-muted-foreground">{t('admin-common.states.loading')}</p>
                    ) : (
                        <div className="space-y-3">
                            {resolvedThresholds.map((resolved) => (
                                <div
                                    key={resolved.context}
                                    className="flex items-center justify-between rounded-md border p-3"
                                >
                                    <div className="space-y-1">
                                        <span className="font-medium">
                                            {/* biome-ignore lint/suspicious/noExplicitAny: dynamic context key resolved at runtime */}
                                            {t(
                                                `content-moderation.thresholds.resolved.contexts.${resolved.context}` as never
                                            )}
                                        </span>
                                        <span className="block text-muted-foreground text-xs">
                                            {resolved.context}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span>
                                            {t(
                                                'content-moderation.thresholds.resolved.pendingLabel'
                                            )}
                                            :{' '}
                                            <code className="font-mono">
                                                {resolved.pending.toFixed(3)}
                                            </code>
                                        </span>
                                        <span>
                                            {t(
                                                'content-moderation.thresholds.resolved.rejectLabel'
                                            )}
                                            :{' '}
                                            <code className="font-mono">
                                                {resolved.reject.toFixed(3)}
                                            </code>
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {/* biome-ignore lint/suspicious/noExplicitAny: dynamic source key resolved at runtime */}
                                            {t(
                                                `content-moderation.thresholds.sources.${resolved.source}` as never
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
