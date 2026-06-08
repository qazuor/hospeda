import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    useDeleteModerationTerm,
    useModerationTermDetail
} from '@/features/content-moderation/hooks/useModerationTermQuery';
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

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">Loading...</div>;
    }

    if (!term) {
        return <div className="p-8 text-muted-foreground">Term not found.</div>;
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_TERM_VIEW]}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">{term.term}</h1>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => navigate({ to: `/content/moderation-terms/${id}/edit` })}
                        >
                            Editar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                if (
                                    confirm('¿Estás seguro de que quieres eliminar este término?')
                                ) {
                                    await deleteMutation.mutateAsync(id);
                                    navigate({ to: '/content/moderation-terms' });
                                }
                            }}
                            disabled={deleteMutation.isPending}
                        >
                            Eliminar
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Información del término</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-muted-foreground text-sm">Término</span>
                                <p className="font-medium">{term.term}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">Tipo</span>
                                <p>
                                    <Badge variant={term.kind === 'word' ? 'default' : 'secondary'}>
                                        {term.kind}
                                    </Badge>
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">Categoría</span>
                                <p>
                                    <Badge variant="outline">{term.category}</Badge>
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">Severidad</span>
                                <p className="font-mono">{term.severity.toFixed(3)}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">Estado</span>
                                <p>
                                    <Badge variant={term.enabled ? 'default' : 'destructive'}>
                                        {term.enabled ? 'Habilitado' : 'Deshabilitado'}
                                    </Badge>
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-sm">Creado</span>
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
