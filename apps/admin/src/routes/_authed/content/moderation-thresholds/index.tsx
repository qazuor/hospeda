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
import { fetchApi } from '@/lib/api/client';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
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
    const updateMutation = useUpdateModerationThreshold();
    const [resolvedThresholds, setResolvedThresholds] = useState<ResolvedThreshold[]>([]);
    const [resolvedLoading, setResolvedLoading] = useState(false);

    const thresholds = listData?.data ?? [];
    const defaultRow = thresholds.find((th: { context: string }) => th.context === 'default');

    const form = useForm({
        defaultValues: {
            pending: defaultRow?.pending ?? 0.5,
            reject: defaultRow?.reject ?? 0.85
        },
        onSubmit: async ({ value }) => {
            if (!defaultRow) return;
            const validation = updateContentModerationThresholdSchema.safeParse(value);
            if (!validation.success) return;
            await updateMutation.mutateAsync({ id: defaultRow.id, data: validation.data });
            fetchResolvedThresholds();
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
        if (defaultRow) {
            fetchResolvedThresholds();
        }
    }, [defaultRow]);

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">Loading...</div>;
    }

    if (!defaultRow) {
        return <div className="p-8 text-muted-foreground">No default threshold row found.</div>;
    }

    // Use type assertion for new namespace keys not yet in TranslationKey union
    const tk = (key: string) => t(key as TranslationKey);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_THRESHOLD_VIEW]}>
            <div className="space-y-6">
                <div>
                    <h1 className="font-bold text-2xl">
                        {tk('content-moderation.thresholds.title')}
                    </h1>
                    <p className="text-muted-foreground">
                        {tk('content-moderation.thresholds.description')}
                    </p>
                </div>

                {/* Default row edit form */}
                <Card>
                    <CardHeader>
                        <CardTitle>{tk('content-moderation.thresholds.title')}</CardTitle>
                        <CardDescription>
                            Context: <code>default</code> —{' '}
                            {tk('content-moderation.thresholds.fields.context')}
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
                                            {tk('content-moderation.thresholds.form.pendingLabel')}
                                        </label>
                                        <Input
                                            id="pending"
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            {tk('content-moderation.thresholds.form.pendingHelp')}
                                        </p>
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
                                            {tk('content-moderation.thresholds.form.rejectLabel')}
                                        </label>
                                        <Input
                                            id="reject"
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            {tk('content-moderation.thresholds.form.rejectHelp')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <Button
                                type="submit"
                                disabled={updateMutation.isPending}
                            >
                                {updateMutation.isPending
                                    ? '...'
                                    : tk('admin-entities.form.title.save')}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Effective bar per context panel */}
                <Card>
                    <CardHeader>
                        <CardTitle>{tk('content-moderation.thresholds.resolved.title')}</CardTitle>
                        <CardDescription>
                            {tk('content-moderation.thresholds.resolved.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {resolvedLoading ? (
                            <p className="text-muted-foreground">Loading...</p>
                        ) : (
                            <div className="space-y-3">
                                {resolvedThresholds.map((resolved) => (
                                    <div
                                        key={resolved.context}
                                        className="flex items-center justify-between rounded-md border p-3"
                                    >
                                        <div className="space-y-1">
                                            <span className="font-medium">
                                                {tk(
                                                    `content-moderation.thresholds.resolved.contexts.${resolved.context}`
                                                )}
                                            </span>
                                            <span className="block text-muted-foreground text-xs">
                                                {resolved.context}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span>
                                                {tk(
                                                    'content-moderation.thresholds.resolved.pendingLabel'
                                                )}
                                                :{' '}
                                                <code className="font-mono">
                                                    {resolved.pending.toFixed(3)}
                                                </code>
                                            </span>
                                            <span>
                                                {tk(
                                                    'content-moderation.thresholds.resolved.rejectLabel'
                                                )}
                                                :{' '}
                                                <code className="font-mono">
                                                    {resolved.reject.toFixed(3)}
                                                </code>
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {tk(
                                                    `content-moderation.thresholds.sources.${resolved.source}`
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
        </RoutePermissionGuard>
    );
}
