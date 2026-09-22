import type { ContentModerationTerm } from '@repo/schemas';
import { PermissionEnum, updateContentModerationTermSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useToast } from '@/components/ui/ToastProvider';
import {
    useModerationTermDetail,
    useUpdateModerationTerm
} from '@/features/content-moderation/hooks/useModerationTermQuery';
import {
    buildModerationCategoryOptions,
    buildModerationTermKindOptions
} from '@/features/content-moderation/moderation-term-options';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

export const Route = createFileRoute('/_authed/content/moderation-terms/$id_/edit')({
    component: ModerationTermEditPage,
    loader: async ({ params }) => ({ termId: params.id }),
    errorComponent: createErrorComponent('ModerationTerm'),
    pendingComponent: createPendingComponent()
});

function ModerationTermEditPage() {
    const { id } = Route.useParams();
    const { data: term, isLoading } = useModerationTermDetail(id);
    const { t } = useTranslations();

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">{t('admin-common.states.loading')}</div>;
    }

    if (!term) {
        return (
            <div className="p-8 text-muted-foreground">
                {t('admin-entities.messages.error.notFound', {
                    entity: t('content-moderation.terms.singular')
                })}
            </div>
        );
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_TERM_UPDATE]}>
            <ModerationTermEditForm
                id={id}
                term={term}
            />
        </RoutePermissionGuard>
    );
}

interface ModerationTermEditFormProps {
    readonly id: string;
    readonly term: ContentModerationTerm;
}

/**
 * Inner form component — only mounts once `term` is defined,
 * so `useForm` receives the real server values as `defaultValues`
 * on first render and never needs a reset.
 */
function ModerationTermEditForm({ id, term }: ModerationTermEditFormProps) {
    const navigate = useNavigate();
    const updateMutation = useUpdateModerationTerm();
    const { t } = useTranslations();
    const { addToast } = useToast();

    // Derived from the schema this form validates against, so the selects can
    // never offer a value `safeParse` refuses. This screen hand-rolls its
    // Selects instead of going through EntityFormSection, so it was never
    // covered by the `config`/`typeConfig` typo — its hardcoded `self_harm`
    // option has been live the whole time (HOS-1068).
    const { options: kindOptions } = buildModerationTermKindOptions({ t });
    const { options: categoryOptions } = buildModerationCategoryOptions({ t });

    const form = useForm({
        defaultValues: {
            term: term.term,
            kind: term.kind as 'word' | 'domain',
            category: term.category,
            severity: term.severity,
            enabled: term.enabled
        },
        onSubmit: async ({ value }) => {
            const validation = updateContentModerationTermSchema.safeParse(value);
            if (!validation.success) {
                // This used to be a bare `return`. Nothing else in this form
                // surfaces a validation failure — there are no `validators`, so
                // `field.state.meta.errors` is always empty — which meant a
                // rejected value produced no save, no navigation and no
                // message at all. Silence is the worst possible answer here:
                // the operator cannot tell a refusal from a broken button.
                addToast({
                    title: t('content-moderation.terms.messages.updateError'),
                    message: validation.error.issues
                        .map((issue) => `${issue.path.join('.') || 'form'}: ${issue.message}`)
                        .join(' · '),
                    variant: 'error'
                });
                return;
            }
            await updateMutation.mutateAsync({ id, data: validation.data });
            navigate({ to: `/content/moderation-terms/${id}` });
        }
    });

    return (
        <div className="space-y-6">
            <h1 className="font-bold text-2xl">{t('content-moderation.terms.edit')}</h1>

            <Card>
                <CardHeader>
                    <CardTitle>{t('content-moderation.terms.edit')}</CardTitle>
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
                        <form.Field name="term">
                            {(field) => (
                                <div className="space-y-1">
                                    <label
                                        className="font-medium text-sm"
                                        htmlFor="term"
                                    >
                                        {t('content-moderation.terms.form.termLabel')}
                                    </label>
                                    <Input
                                        id="term"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder={t(
                                            'content-moderation.terms.form.termPlaceholder'
                                        )}
                                    />
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {field.state.meta.errors.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="kind">
                            {(field) => (
                                <div className="space-y-1">
                                    <label
                                        className="font-medium text-sm"
                                        htmlFor="kind"
                                    >
                                        {t('content-moderation.terms.form.kindLabel')}
                                    </label>
                                    <Select
                                        value={field.state.value}
                                        onValueChange={(v) =>
                                            field.handleChange(v as 'word' | 'domain')
                                        }
                                    >
                                        <SelectTrigger
                                            id="kind"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {kindOptions.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {field.state.meta.errors.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="category">
                            {(field) => (
                                <div className="space-y-1">
                                    <label
                                        className="font-medium text-sm"
                                        htmlFor="category"
                                    >
                                        {t('content-moderation.terms.form.categoryLabel')}
                                    </label>
                                    <Select
                                        value={field.state.value}
                                        onValueChange={(v) => field.handleChange(v as never)}
                                    >
                                        <SelectTrigger
                                            id="category"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categoryOptions.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {field.state.meta.errors.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="severity">
                            {(field) => (
                                <div className="space-y-1">
                                    <label
                                        className="font-medium text-sm"
                                        htmlFor="severity"
                                    >
                                        {t('content-moderation.terms.form.severityLabel')}
                                    </label>
                                    <Input
                                        id="severity"
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(Number(e.target.value))}
                                        onBlur={field.handleBlur}
                                    />
                                    {field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {field.state.meta.errors.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="enabled">
                            {(field) => (
                                <div className="flex items-center gap-2">
                                    <input
                                        id="enabled"
                                        type="checkbox"
                                        checked={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.checked)}
                                    />
                                    <label
                                        className="font-medium text-sm"
                                        htmlFor="enabled"
                                    >
                                        {t('content-moderation.terms.form.enabledLabel')}
                                    </label>
                                </div>
                            )}
                        </form.Field>

                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                disabled={updateMutation.isPending}
                            >
                                {updateMutation.isPending
                                    ? t('admin-entities.messages.saving')
                                    : t('admin-entities.actions.save')}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate({ to: `/content/moderation-terms/${id}` })}
                            >
                                {t('admin-entities.actions.cancel')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
