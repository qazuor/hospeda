import type { EntityTagAssignment } from '@/hooks/use-entity-attribution';
import { PostTagColorBadge } from './PostTagColorBadge';

/** Tag type label map for the attribution badge. */
const TAG_TYPE_BADGE: Readonly<Record<string, string>> = {
    SYSTEM: 'bg-blue-100 text-blue-800',
    INTERNAL: 'bg-purple-100 text-purple-800',
    USER: 'bg-gray-100 text-gray-700'
} as const;

const TAG_TYPE_LABEL: Readonly<Record<string, string>> = {
    SYSTEM: 'Sistema',
    INTERNAL: 'Interno',
    USER: 'Usuario'
} as const;

interface EntityAttributionListProps {
    /** List of tag assignments for this entity. */
    readonly assignments: ReadonlyArray<EntityTagAssignment>;
    /** Whether data is still loading. */
    readonly isLoading: boolean;
    /** Error if the query failed. */
    readonly error: Error | null;
    /** Human-readable label for the entity being displayed (e.g., "Alojamiento"). */
    readonly entityLabel?: string;
}

/**
 * Read-only list of tag assignments on a given entity, with attribution info.
 *
 * Each row shows:
 * - Tag type badge (SYSTEM / INTERNAL / USER)
 * - Tag color swatch
 * - Tag name
 * - "Assigned by" user identifier (display name or email, with fallback to ID)
 * - Assignment timestamp
 *
 * Gate: caller must have `TAG_VIEW_ALL_ASSIGNMENTS` permission.
 * The route enforces the gate; this component renders unconditionally.
 *
 * @see AC-007-01
 */
export function EntityAttributionList({
    assignments,
    isLoading,
    error,
    entityLabel = 'entidad'
}: EntityAttributionListProps) {
    if (isLoading) {
        return (
            <p className="text-muted-foreground text-sm">Cargando atribuciones de etiquetas...</p>
        );
    }

    if (error) {
        return (
            <p
                className="text-destructive text-sm"
                role="alert"
            >
                Error al cargar las atribuciones. Intentá de nuevo.
            </p>
        );
    }

    if (assignments.length === 0) {
        return (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                Esta {entityLabel} no tiene etiquetas asignadas.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border">
            <table
                className="w-full text-sm"
                aria-label="Atribución de etiquetas"
            >
                <thead className="bg-muted/50">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">Tipo</th>
                        <th className="px-4 py-3 text-left font-medium">Etiqueta</th>
                        <th className="px-4 py-3 text-left font-medium">Asignada por</th>
                        <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {assignments.map((assignment) => {
                        const assignedBy =
                            assignment.assignedByDisplayName ??
                            assignment.assignedByEmail ??
                            assignment.assignedById;

                        const assignedAt = new Date(assignment.assignedAt).toLocaleDateString(
                            'es-AR',
                            { day: '2-digit', month: '2-digit', year: 'numeric' }
                        );

                        const tagType = assignment.tag.type;

                        return (
                            <tr
                                key={assignment.tagId}
                                className="transition-colors hover:bg-muted/30"
                            >
                                {/* Tag type badge */}
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${TAG_TYPE_BADGE[tagType] ?? 'bg-gray-100 text-gray-600'}`}
                                    >
                                        {TAG_TYPE_LABEL[tagType] ?? tagType}
                                    </span>
                                </td>

                                {/* Tag name + color */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <PostTagColorBadge color={assignment.tag.color} />
                                        <span className="font-medium">{assignment.tag.name}</span>
                                    </div>
                                </td>

                                {/* Attribution */}
                                <td className="px-4 py-3 text-muted-foreground">
                                    <span
                                        className="block max-w-[200px] truncate"
                                        title={assignedBy}
                                    >
                                        {assignedBy}
                                    </span>
                                </td>

                                {/* Date */}
                                <td className="px-4 py-3 text-muted-foreground">{assignedAt}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
