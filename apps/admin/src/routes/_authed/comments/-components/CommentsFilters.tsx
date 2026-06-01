/**
 * @file CommentsFilters.tsx
 * @description Filter controls for the admin comment moderation queue (SPEC-165 T-017).
 *
 * Provides entityType / moderationState dropdowns + free-text search input,
 * following the same pattern as SubscriberFilters.tsx.
 */

import { useTranslations } from '@/hooks/use-translations';

/** Shape of the filter state managed by the parent page. */
export interface CommentsFiltersValue {
    readonly entityType: 'POST' | 'EVENT' | '';
    readonly moderationState: 'APPROVED' | 'REJECTED' | 'PENDING' | '';
    readonly search: string;
    readonly includeDeleted: boolean;
}

/** Props for {@link CommentsFilters}. */
export interface CommentsFiltersProps {
    readonly value: CommentsFiltersValue;
    readonly onChange: (next: CommentsFiltersValue) => void;
}

/**
 * Filter bar for the comment moderation queue.
 * Uses native HTML `<select>` and `<input>` elements — no Shadcn Select here
 * to keep the pattern consistent with the subscribers page.
 *
 * @param props - {@link CommentsFiltersProps}
 */
export function CommentsFilters({ value, onChange }: CommentsFiltersProps) {
    const { t } = useTranslations();

    return (
        <div className="flex flex-wrap items-end gap-3">
            {/* Entity type filter */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-entity-type"
                    className="text-muted-foreground text-xs"
                >
                    {t('comments.list.filters.entityType')}
                </label>
                <select
                    id="filter-entity-type"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.entityType}
                    onChange={(e) =>
                        onChange({ ...value, entityType: e.target.value as 'POST' | 'EVENT' | '' })
                    }
                >
                    <option value="">Todos</option>
                    <option value="POST">Post</option>
                    <option value="EVENT">Evento</option>
                </select>
            </div>

            {/* Moderation state filter */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-moderation-state"
                    className="text-muted-foreground text-xs"
                >
                    {t('comments.list.filters.moderationState')}
                </label>
                <select
                    id="filter-moderation-state"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.moderationState}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            moderationState: e.target.value as
                                | 'APPROVED'
                                | 'REJECTED'
                                | 'PENDING'
                                | ''
                        })
                    }
                >
                    <option value="">Todos</option>
                    <option value="APPROVED">{t('comments.moderation.approved')}</option>
                    <option value="REJECTED">{t('comments.moderation.rejected')}</option>
                    <option value="PENDING">{t('comments.moderation.pending')}</option>
                </select>
            </div>

            {/* Free-text search */}
            <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                <label
                    htmlFor="filter-search"
                    className="text-muted-foreground text-xs"
                >
                    Buscar
                </label>
                <input
                    id="filter-search"
                    type="search"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    placeholder="Contenido, autor…"
                    value={value.search}
                    onChange={(e) => onChange({ ...value, search: e.target.value })}
                />
            </div>

            {/* Include deleted toggle */}
            <div className="flex items-center gap-2 self-end pb-1">
                <input
                    id="filter-include-deleted"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={value.includeDeleted}
                    onChange={(e) => onChange({ ...value, includeDeleted: e.target.checked })}
                />
                <label
                    htmlFor="filter-include-deleted"
                    className="cursor-pointer text-muted-foreground text-sm"
                >
                    Incluir eliminados
                </label>
            </div>
        </div>
    );
}
