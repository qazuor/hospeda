import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    useAssignTag,
    useEntityTagAssignments,
    useRemoveTag
} from '@/hooks/use-entity-tag-assignments';
import { useOwnTagQuota } from '@/hooks/use-own-tags';
import { usePickerTags } from '@/hooks/use-picker-tags';
import { LoaderIcon, TagsIcon } from '@repo/icons';
import type { EntityTypeEnum, Tag } from '@repo/schemas';
import { useCallback, useMemo, useRef, useState } from 'react';
import { CreateOwnTagDialog } from './CreateOwnTagDialog';
import { TagPickerOption } from './TagPickerOption';

interface TagPickerProps {
    /** The entity type being tagged. */
    readonly entityType: EntityTypeEnum;
    /** The entity UUID being tagged. */
    readonly entityId: string;
    /** Additional CSS classes for the container. */
    readonly className?: string;
}

/**
 * Searchable multi-select tag picker for assigning/removing own USER,
 * SYSTEM, and INTERNAL tags from entities.
 *
 * UI:
 * - Search input (debounced — passed to server-side safeIlike per D-014)
 * - Grouped results: Sistema → Interno (if actor has TAG_INTERNAL_VIEW) → Personal
 * - Already-applied tags appear checked
 * - Bottom CTA: "+ Crear tag personal" (disabled at quota)
 * - Optimistic UI for assign/unassign (via useAssignTag / useRemoveTag)
 *
 * @see D-006, D-008, D-014, D-024, US-002, AC-002-01..03
 * @see SPEC-086 T-033
 */
export function TagPicker({ entityType, entityId, className = '' }: TagPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Debounce search input to reduce API requests
    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(value);
        }, 300);
    }, []);

    const { groups, isLoading: isLoadingTags } = usePickerTags(debouncedSearch || undefined);
    const { data: assignments = [], isLoading: isLoadingAssignments } = useEntityTagAssignments(
        entityType,
        entityId,
        isOpen
    );

    const { data: quotaData } = useOwnTagQuota();
    const isAtQuota = (quotaData?.used ?? 0) >= (quotaData?.limit ?? 50);

    const assignMutation = useAssignTag(entityType, entityId);
    const removeMutation = useRemoveTag(entityType, entityId);

    const assignedIds = useMemo(() => new Set(assignments.map((t) => t.id)), [assignments]);

    const pendingTagId = assignMutation.isPending
        ? (assignMutation.variables as string | undefined)
        : removeMutation.isPending
          ? (removeMutation.variables as string | undefined)
          : undefined;

    function handleToggle(tagId: string) {
        if (assignedIds.has(tagId)) {
            removeMutation.mutate(tagId);
        } else {
            assignMutation.mutate(tagId);
        }
    }

    const totalCount = assignedIds.size;
    const hasAnyTags =
        groups.system.length > 0 || groups.internal.length > 0 || groups.userOwn.length > 0;

    return (
        <div
            className={`relative ${className}`}
            data-testid="tag-picker"
        >
            {/* Trigger button */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className="gap-1.5"
                data-testid="tag-picker-trigger"
            >
                <TagsIcon
                    className="h-4 w-4"
                    aria-hidden="true"
                />
                Tags
                {totalCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 font-semibold text-[10px] text-primary-foreground">
                        {totalCount}
                    </span>
                )}
            </Button>

            {/* Dropdown panel */}
            {isOpen && (
                <dialog
                    open
                    className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border bg-popover p-0 shadow-md"
                    aria-label="Selector de tags"
                    data-testid="tag-picker-panel"
                >
                    {/* Search */}
                    <div className="border-b p-2">
                        <Input
                            placeholder="Buscar tags..."
                            value={searchInput}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="h-8 text-sm"
                            aria-label="Buscar tags"
                            data-testid="tag-picker-search"
                            autoFocus
                        />
                    </div>

                    {/* Tag list */}
                    <div
                        className="max-h-64 overflow-y-auto p-1"
                        aria-label="Tags disponibles"
                    >
                        {(isLoadingTags || isLoadingAssignments) && (
                            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                                <LoaderIcon
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                                Cargando...
                            </div>
                        )}

                        {!isLoadingTags && !isLoadingAssignments && !hasAnyTags && (
                            <p
                                className="py-4 text-center text-muted-foreground text-xs"
                                data-testid="no-tags-message"
                            >
                                No hay tags disponibles
                            </p>
                        )}

                        {/* Sistema group */}
                        {groups.system.length > 0 && (
                            <TagGroup
                                label="Sistema"
                                tags={groups.system}
                                assignedIds={assignedIds}
                                pendingTagId={pendingTagId}
                                onToggle={handleToggle}
                            />
                        )}

                        {/* Interno group — only shown if actor has TAG_INTERNAL_VIEW */}
                        {groups.internal.length > 0 && (
                            <TagGroup
                                label="Internos"
                                tags={groups.internal}
                                assignedIds={assignedIds}
                                pendingTagId={pendingTagId}
                                onToggle={handleToggle}
                                data-testid="internal-group"
                            />
                        )}

                        {/* Personal / own USER group */}
                        {groups.userOwn.length > 0 && (
                            <TagGroup
                                label="Tus tags"
                                tags={groups.userOwn}
                                assignedIds={assignedIds}
                                pendingTagId={pendingTagId}
                                onToggle={handleToggle}
                            />
                        )}
                    </div>

                    {/* Footer: create own tag CTA */}
                    <div className="border-t p-2">
                        {isAtQuota ? (
                            <p
                                className="text-center text-destructive text-xs"
                                data-testid="quota-reached-notice"
                            >
                                Alcanzaste el límite de tags personales
                            </p>
                        ) : (
                            <CreateOwnTagDialog
                                isAtQuota={isAtQuota}
                                onCreated={() => {
                                    // Picker stays open; new tag appears via cache invalidation
                                }}
                                trigger={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs"
                                        data-testid="create-own-tag-cta"
                                    >
                                        + Crear tag personal
                                    </Button>
                                }
                            />
                        )}
                    </div>
                </dialog>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Internal: group renderer
// ---------------------------------------------------------------------------

interface TagGroupProps {
    readonly label: string;
    readonly tags: Tag[];
    readonly assignedIds: Set<string>;
    readonly pendingTagId?: string;
    readonly onToggle: (tagId: string) => void;
    readonly 'data-testid'?: string;
}

function TagGroup({
    label,
    tags,
    assignedIds,
    pendingTagId,
    onToggle,
    'data-testid': testId
}: TagGroupProps) {
    return (
        <div
            className="mb-1"
            data-testid={testId}
        >
            <p className="px-2 py-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                {label}
            </p>
            {tags.map((tag) => (
                <TagPickerOption
                    key={tag.id}
                    tag={tag}
                    isChecked={assignedIds.has(tag.id)}
                    onToggle={onToggle}
                    isPending={pendingTagId === tag.id}
                />
            ))}
        </div>
    );
}
