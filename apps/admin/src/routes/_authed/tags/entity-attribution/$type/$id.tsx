import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityAttributionList } from '@/components/tags/EntityAttributionList';
import { useEntityAttribution } from '@/hooks/use-entity-attribution';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { TagsIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/tags/entity-attribution/$type/$id')({
    component: EntityAttributionPage,
    loader: async ({ params }) => ({ entityType: params.type, entityId: params.id }),
    errorComponent: createErrorComponent('EntityAttribution'),
    pendingComponent: createPendingComponent()
});

/** Friendly display name for known entity types. */
const ENTITY_LABELS: Readonly<Record<string, string>> = {
    accommodation: 'alojamiento',
    event: 'evento',
    destination: 'destino',
    post: 'publicación',
    user: 'usuario'
} as const;

/**
 * Entity tag attribution page.
 *
 * Displays the full list of tag assignments for a given entity, including:
 * - Tag type (SYSTEM / INTERNAL / USER)
 * - Tag name + color
 * - Who assigned it (display name, email, or ID)
 * - When it was assigned
 *
 * URL params: `$type` = entity type string, `$id` = entity UUID.
 *
 * Gate: requires `TAG_VIEW_ALL_ASSIGNMENTS` permission.
 *
 * Reachable from user-moderation page or any entity detail page that links here.
 *
 * @see SPEC-086 Phase 7 / T-031
 * @see AC-007-01, AC-F06
 */
function EntityAttributionPage() {
    const { type: entityType, id: entityId } = Route.useParams();
    const entityLabel = ENTITY_LABELS[entityType] ?? entityType;

    const { data, isLoading, error } = useEntityAttribution(entityType, entityId);

    const assignments = data?.assignments ?? [];

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS]}>
            <div className="space-y-6 p-6">
                {/* Page header */}
                <div className="flex items-center gap-2">
                    <TagsIcon
                        className="h-6 w-6 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <div>
                        <h1 className="font-bold text-2xl">Atribución de etiquetas</h1>
                        <p className="mt-0.5 text-muted-foreground text-sm capitalize">
                            {entityLabel} · <code className="text-xs">{entityId}</code>
                        </p>
                    </div>
                </div>

                {/* Breadcrumb shortcut back to moderation */}
                <nav
                    aria-label="Navegación"
                    className="text-muted-foreground text-sm"
                >
                    <ol className="flex items-center gap-1">
                        <li>
                            <Link
                                to="/tags/user-moderation"
                                className="hover:underline"
                            >
                                Moderación de etiquetas
                            </Link>
                        </li>
                        <li aria-hidden="true">/</li>
                        <li aria-current="page">Atribución · {entityLabel}</li>
                    </ol>
                </nav>

                <EntityAttributionList
                    assignments={assignments}
                    isLoading={isLoading}
                    error={error}
                    entityLabel={entityLabel}
                />
            </div>
        </RoutePermissionGuard>
    );
}
