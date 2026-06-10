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
import {
    useModerationTermDetail,
    useUpdateModerationTerm
} from '@/features/content-moderation/hooks/useModerationTermQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { ContentModerationTerm } from '@repo/schemas';
import { PermissionEnum, updateContentModerationTermSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

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
            if (!validation.success) return;
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
                                            <SelectItem value="word">
                                                {t('content-moderation.terms.kinds.word')}
                                            </SelectItem>
                                            <SelectItem value="domain">
                                                {t('content-moderation.terms.kinds.domain')}
                                            </SelectItem>
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
                                            <SelectItem value="hate">
                                                {t('content-moderation.categories.hate')}
                                            </SelectItem>
                                            <SelectItem value="sexual">
                                                {t('content-moderation.categories.sexual')}
                                            </SelectItem>
                                            <SelectItem value="violence">
                                                {t('content-moderation.categories.violence')}
                                            </SelectItem>
                                            <SelectItem value="harassment">
                                                {t('content-moderation.categories.harassment')}
                                            </SelectItem>
                                            <SelectItem value="self_harm">
                                                {t('content-moderation.categories.self_harm')}
                                            </SelectItem>
                                            <SelectItem value="spam">
                                                {t('content-moderation.categories.spam')}
                                            </SelectItem>
                                            <SelectItem value="other">
                                                {t('content-moderation.categories.other')}
                                            </SelectItem>
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
