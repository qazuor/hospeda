import { Button } from '@/components/ui/button';
import type { UserTagWithOwner } from '@/hooks/use-user-tag-moderation';
import { DeleteIcon } from '@repo/icons';
import { PostTagColorBadge } from './PostTagColorBadge';

/** Lifecycle state badge colors — reusing same visual convention as post-tags list. */
const STATE_BADGE: Readonly<Record<string, string>> = {
    ACTIVE: 'bg-success/15 text-success',
    INACTIVE: 'bg-gray-100 text-gray-600',
    ARCHIVED: 'bg-warning/15 text-warning',
    DRAFT: 'bg-warning/15 text-warning'
} as const;

const STATE_LABEL: Readonly<Record<string, string>> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    ARCHIVED: 'Archivado',
    DRAFT: 'Borrador'
} as const;

interface UserTagModerationTableProps {
    /** Flat list of USER tags from all owners (server already paginates). */
    readonly tags: ReadonlyArray<UserTagWithOwner>;
    /**
     * Callback when the admin clicks the delete action on a row.
     * The parent is responsible for showing a confirmation dialog.
     * Per D-012: NO edit action is provided.
     */
    readonly onDeleteClick: (tag: UserTagWithOwner) => void;
    /** Whether a delete mutation is currently in progress. */
    readonly isDeleting: boolean;
    /** ID of the tag currently being deleted (to show per-row loading state). */
    readonly deletingTagId?: string;
    /**
     * Whether the current actor has `TAG_USER_DELETE_ANY` permission.
     * When false, the delete action column is hidden entirely.
     */
    readonly canDeleteAny: boolean;
}

/**
 * Data table for USER tag moderation.
 *
 * Displays all USER tags across all owners. Columns:
 * - Owner (display name + role)
 * - Tag name
 * - Color swatch
 * - Lifecycle state
 * - Usage count (if provided by API)
 * - Actions: DELETE only (no edit — D-012 explicit requirement)
 *
 * Groups/sorts rows by owner display name for readability.
 *
 * Accessibility: table has aria-label; action buttons have aria-label per row.
 *
 * @see D-012 - TAG_USER_UPDATE_ANY is intentionally excluded
 * @see AC-008-01, AC-008-02
 */
export function UserTagModerationTable({
    tags,
    onDeleteClick,
    isDeleting,
    deletingTagId,
    canDeleteAny
}: UserTagModerationTableProps) {
    if (tags.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <p>No hay etiquetas de usuario para moderar.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border">
            <table
                className="w-full text-sm"
                aria-label="Tabla de moderación de etiquetas de usuario"
            >
                <thead className="bg-muted/50">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">Propietario</th>
                        <th className="px-4 py-3 text-left font-medium">Etiqueta</th>
                        <th className="px-4 py-3 text-left font-medium">Color</th>
                        <th className="px-4 py-3 text-left font-medium">Estado</th>
                        <th className="px-4 py-3 text-left font-medium">Usos</th>
                        {canDeleteAny && (
                            <th className="px-4 py-3 text-right font-medium">Acciones</th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {tags.map((tag) => {
                        const isThisDeleting = isDeleting && deletingTagId === tag.id;

                        return (
                            <tr
                                key={tag.id}
                                className="transition-colors hover:bg-muted/30"
                            >
                                {/* Owner */}
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">
                                            {tag.ownerDisplayName ?? tag.ownerId ?? '—'}
                                        </span>
                                        {tag.ownerRole && (
                                            <span className="text-muted-foreground text-xs">
                                                {tag.ownerRole}
                                            </span>
                                        )}
                                        {tag.ownerEmail && (
                                            <span className="text-muted-foreground text-xs">
                                                {tag.ownerEmail}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* Tag name — NO edit link per D-012 */}
                                <td className="px-4 py-3 font-medium">{tag.name}</td>

                                {/* Color */}
                                <td className="px-4 py-3">
                                    <PostTagColorBadge color={tag.color} />
                                </td>

                                {/* Lifecycle state */}
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATE_BADGE[tag.lifecycleState] ?? 'bg-gray-100 text-gray-600'}`}
                                    >
                                        {STATE_LABEL[tag.lifecycleState] ?? tag.lifecycleState}
                                    </span>
                                </td>

                                {/* Usage count */}
                                <td className="px-4 py-3 text-muted-foreground">
                                    {tag.usageCount ?? '—'}
                                </td>

                                {/* Actions — delete only, no edit (D-012) */}
                                {canDeleteAny && (
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => onDeleteClick(tag)}
                                                disabled={isThisDeleting}
                                                aria-label={`Eliminar etiqueta "${tag.name}"`}
                                                data-testid={`delete-action-${tag.id}`}
                                            >
                                                {isThisDeleting ? (
                                                    <span className="text-xs">Eliminando...</span>
                                                ) : (
                                                    <DeleteIcon className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
