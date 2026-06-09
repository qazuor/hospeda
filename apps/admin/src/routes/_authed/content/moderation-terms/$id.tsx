import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    useDeleteModerationTerm,
    useModerationTermDetail
} from '@/features/content-moderation/hooks/useModerationTermQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/content/moderation-terms/$id')({
    component: ModerationTermViewPage,
    loader: async ({ params }) => ({ termId: params.id }),
    errorComponent: createErrorComponent('ModerationTerm'),
    pendingComponent: createPendingComponent()
});

function ModerationTermViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { data: term, isLoading } = useModerationTermDetail(id);
    const deleteMutation = useDeleteModerationTerm();
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
        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_TERM_VIEW]}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">{term.term}</h1>
                    <div className="flex gap-2">
                        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_TERM_UPDATE]}>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    navigate({ to: `/content/moderation-terms/${id}/edit` })
                                }
                            >
                                {t('admin-entities.actions.edit')}
                            </Button>
                        </RoutePermissionGuard>

                        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_TERM_DELETE]}>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        disabled={deleteMutation.isPending}
                                    >
                                        {t('admin-entities.actions.delete')}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {t('admin-entities.actions.delete')}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t('content-moderation.terms.messages.confirmDelete')}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            {t('admin-entities.actions.cancel')}
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={async () => {
                                                await deleteMutation.mutateAsync(id);
                                                navigate({ to: '/content/moderation-terms' });
                                            }}
                                        >
                                            {t('admin-entities.actions.delete')}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </RoutePermissionGuard>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('content-moderation.terms.view')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-muted-foreground text-sm">
                                    {t('content-moderation.terms.fields.term')}
                                </span>
                                <p className="font-medium">{term.term}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">
                                    {t('content-moderation.terms.fields.kind')}
                                </span>
                                <p>
                                    <Badge variant={term.kind === 'word' ? 'default' : 'secondary'}>
                                        {t(
                                            term.kind === 'word'
                                                ? 'content-moderation.terms.kinds.word'
                                                : 'content-moderation.terms.kinds.domain'
                                        )}
                                    </Badge>
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">
                                    {t('content-moderation.terms.fields.category')}
                                </span>
                                <p>
                                    <Badge variant="outline">
                                        {/* biome-ignore lint/suspicious/noExplicitAny: dynamic category key resolved at runtime */}
                                        {t(
                                            `content-moderation.categories.${term.category}` as never
                                        )}
                                    </Badge>
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">
                                    {t('content-moderation.terms.fields.severity')}
                                </span>
                                <p className="font-mono">{term.severity.toFixed(3)}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">
                                    {t('content-moderation.terms.fields.enabled')}
                                </span>
                                <p>
                                    <Badge variant={term.enabled ? 'default' : 'destructive'}>
                                        {term.enabled
                                            ? t('admin-entities.viewFields.boolean.enabled')
                                            : t('admin-entities.viewFields.boolean.disabled')}
                                    </Badge>
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">
                                    {t('content-moderation.terms.fields.createdAt')}
                                </span>
                                <p>
                                    {term.createdAt
                                        ? new Date(term.createdAt).toLocaleDateString()
                                        : '—'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </RoutePermissionGuard>
    );
}
