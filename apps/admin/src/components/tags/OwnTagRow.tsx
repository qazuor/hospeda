import { Button } from '@/components/ui/button';
import { DeleteIcon, EditIcon } from '@repo/icons';
import type { Tag } from '@repo/schemas';
import { useState } from 'react';
import { DeleteOwnTagDialog } from './DeleteOwnTagDialog';
import { EditOwnTagDialog } from './EditOwnTagDialog';
import { PostTagColorBadge } from './PostTagColorBadge';

/** Maps lifecycleState values to badge style classes. */
const STATE_BADGE: Readonly<Record<string, string>> = {
    ACTIVE: 'bg-success/15 text-success',
    INACTIVE: 'bg-gray-100 text-gray-600',
    DRAFT: 'bg-warning/15 text-warning',
    ARCHIVED: 'bg-warning/15 text-warning'
} as const;

const STATE_LABEL: Readonly<Record<string, string>> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    DRAFT: 'Borrador',
    ARCHIVED: 'Archivado'
} as const;

interface OwnTagRowProps {
    /** The tag to render. */
    readonly tag: Tag;
    /** Impact count (number of entities this tag is applied to). */
    readonly impactCount?: number;
    /** Callback when delete is confirmed. */
    readonly onDeleteConfirm: (id: string) => void;
    /** Whether a deletion mutation is in progress (for this row). */
    readonly isDeleting: boolean;
}

/**
 * Single row in the OwnTagManager list.
 *
 * Renders tag name (with color swatch), lifecycle state badge, applied-to
 * count, and edit / delete action buttons.
 *
 * Delete uses `DeleteOwnTagDialog` for a two-step confirmation that
 * fetches the impact count lazily.
 *
 * @see OwnTagManager, AC-003-04
 * @see SPEC-086 T-032
 */
export function OwnTagRow({ tag, impactCount, onDeleteConfirm, isDeleting }: OwnTagRowProps) {
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <tr className="transition-colors hover:bg-muted/30">
            {/* Name + color */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <PostTagColorBadge color={tag.color} />
                    <span className="font-medium text-sm">{tag.name}</span>
                </div>
            </td>

            {/* Applied to count */}
            <td className="px-4 py-3 text-muted-foreground text-sm">
                {impactCount !== undefined ? (
                    <span>
                        {impactCount} {impactCount === 1 ? 'entidad' : 'entidades'}
                    </span>
                ) : (
                    <span className="text-muted-foreground/50">—</span>
                )}
            </td>

            {/* Lifecycle state badge */}
            <td className="px-4 py-3">
                <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATE_BADGE[tag.lifecycleState] ?? 'bg-gray-100 text-gray-600'}`}
                >
                    {STATE_LABEL[tag.lifecycleState] ?? tag.lifecycleState}
                </span>
            </td>

            {/* Actions */}
            <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                    <EditOwnTagDialog
                        tag={tag}
                        trigger={
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Editar ${tag.name}`}
                            >
                                <EditIcon className="h-4 w-4" />
                            </Button>
                        }
                    />

                    <DeleteOwnTagDialog
                        tagId={tag.id}
                        tagName={tag.name}
                        open={deleteOpen}
                        onOpenChange={(isOpen) => {
                            setDeleteOpen(isOpen);
                        }}
                        onConfirm={() => {
                            onDeleteConfirm(tag.id);
                            setDeleteOpen(false);
                        }}
                        isDeleting={isDeleting}
                        trigger={
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteOpen(true)}
                                aria-label={`Eliminar ${tag.name}`}
                            >
                                <DeleteIcon className="h-4 w-4" />
                            </Button>
                        }
                    />
                </div>
            </td>
        </tr>
    );
}
