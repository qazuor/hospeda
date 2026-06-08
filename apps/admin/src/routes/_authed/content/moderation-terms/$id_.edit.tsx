import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    useModerationTermDetail,
    useUpdateModerationTerm
} from '@/features/content-moderation/hooks/useModerationTermQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
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
    const navigate = useNavigate();
    const { data: term, isLoading } = useModerationTermDetail(id);
    const updateMutation = useUpdateModerationTerm();

    const form = useForm({
        defaultValues: {
            term: term?.term ?? '',
            kind: term?.kind ?? 'word',
            category: term?.category ?? 'other',
            severity: term?.severity ?? 1.0,
            enabled: term?.enabled ?? true
        },
        onSubmit: async ({ value }) => {
            const validation = updateContentModerationTermSchema.safeParse(value);
            if (!validation.success) return;
            await updateMutation.mutateAsync({ id, data: validation.data });
            navigate({ to: `/content/moderation-terms/${id}` });
        }
    });

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">Loading...</div>;
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.MODERATION_TERM_UPDATE]}>
            <div className="space-y-6">
                <h1 className="font-bold text-2xl">Editar término</h1>

                <Card>
                    <CardHeader>
                        <CardTitle>Información del término</CardTitle>
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
                                            Término
                                        </label>
                                        <Input
                                            id="term"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                        />
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
                                            Tipo
                                        </label>
                                        <select
                                            id="kind"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value as 'word' | 'domain'
                                                )
                                            }
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="word">Palabra</option>
                                            <option value="domain">Dominio</option>
                                        </select>
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
                                            Categoría
                                        </label>
                                        <select
                                            id="category"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(e.target.value as never)
                                            }
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="hate">Odio</option>
                                            <option value="sexual">Sexual</option>
                                            <option value="violence">Violencia</option>
                                            <option value="harassment">Acoso</option>
                                            <option value="self_harm">Autolesión</option>
                                            <option value="spam">Spam</option>
                                            <option value="other">Otro</option>
                                        </select>
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
                                            Severidad (0-1)
                                        </label>
                                        <Input
                                            id="severity"
                                            type="number"
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
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
                                            Habilitado
                                        </label>
                                    </div>
                                )}
                            </form.Field>

                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        navigate({ to: `/content/moderation-terms/${id}` })
                                    }
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </RoutePermissionGuard>
    );
}
