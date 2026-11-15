/**
 * Filter bar of the staff AI conversations list (HOS-2075): vertical, listing id
 * (UUID) and a from/to day range. Controlled by the route's search params.
 *
 * @module features/ai-conversations/components/AiConversationsFilters
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import type { AiConversationsSearch } from '../types';

/** Verticals a listing chat can target (identifiers; labels via i18n). */
const ENTITY_TYPES = ['accommodation', 'venue', 'experience'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Props for {@link AiConversationsFilters}. */
export interface AiConversationsFiltersProps {
    readonly search: AiConversationsSearch;
    /** Called with a partial patch; the caller resets the page to 1. */
    readonly onChange: (patch: Partial<AiConversationsSearch>) => void;
    readonly onReset: () => void;
}

/**
 * Renders the list filters. The listing id input reports a patch only for a
 * valid UUID or an empty value, so an in-progress paste never hits the API.
 */
export function AiConversationsFilters({ search, onChange, onReset }: AiConversationsFiltersProps) {
    const { t } = useTranslations();
    const base = 'admin-pages.ai.conversations.filter';

    return (
        <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="conv-entity-type"
                    className="text-xs"
                >
                    {t(`${base}.vertical` as 'admin-pages.ai.conversations.filter.vertical')}
                </Label>
                <Select
                    value={search.entityType ?? 'all'}
                    onValueChange={(v) =>
                        onChange({
                            entityType:
                                v === 'all' ? undefined : (v as (typeof ENTITY_TYPES)[number])
                        })
                    }
                >
                    <SelectTrigger
                        id="conv-entity-type"
                        className="w-44"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">
                            {t('admin-pages.ai.conversations.filter.allVerticals')}
                        </SelectItem>
                        {ENTITY_TYPES.map((v) => (
                            <SelectItem
                                key={v}
                                value={v}
                            >
                                {t(
                                    `admin-pages.ai.conversations.verticals.${v}` as `admin-pages.ai.conversations.verticals.${typeof v}`
                                )}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="conv-entity-id"
                    className="text-xs"
                >
                    {t('admin-pages.ai.conversations.filter.listingId')}
                </Label>
                <Input
                    id="conv-entity-id"
                    type="text"
                    className="w-80 font-mono text-xs"
                    placeholder={t('admin-pages.ai.conversations.filter.listingIdPlaceholder')}
                    defaultValue={search.entityId ?? ''}
                    onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value === '') onChange({ entityId: undefined });
                        else if (UUID_RE.test(value)) onChange({ entityId: value });
                    }}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="conv-from"
                    className="text-xs"
                >
                    {t('admin-pages.ai.conversations.filter.from')}
                </Label>
                <Input
                    id="conv-from"
                    type="date"
                    className="w-44"
                    value={search.from ?? ''}
                    onChange={(e) => onChange({ from: e.target.value || undefined })}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="conv-to"
                    className="text-xs"
                >
                    {t('admin-pages.ai.conversations.filter.to')}
                </Label>
                <Input
                    id="conv-to"
                    type="date"
                    className="w-44"
                    value={search.to ?? ''}
                    onChange={(e) => onChange({ to: e.target.value || undefined })}
                />
            </div>

            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onReset}
            >
                {t('admin-pages.ai.conversations.filter.reset')}
            </Button>
        </div>
    );
}
