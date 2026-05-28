/**
 * AttractionBadgesCell — renders a destination's attractions as compact badges.
 *
 * Each attraction is a neutral pill showing its icon (resolved from the Material
 * Symbols slug via the shared `getAttractionIcon` in `@repo/icons`) + its name.
 * The list is capped at `maxVisible`; the remainder collapses into a `+N` chip.
 * Renders an em dash when there are no attractions.
 */

import { cn } from '@/lib/utils';
import { getAttractionIcon } from '@repo/icons';

/** A single attraction as projected into the admin list (name + icon slug). */
export interface AttractionBadgeItem {
    readonly name: string;
    readonly icon?: string | null;
}

/** Props for {@link AttractionBadgesCell}. RO-RO pattern. */
export interface AttractionBadgesCellProps {
    /** Attractions to render as badges. */
    readonly attractions?: ReadonlyArray<AttractionBadgeItem> | null;
    /** Max badges shown before collapsing the rest into a `+N` chip. */
    readonly maxVisible?: number;
}

const PILL_CLASS =
    'inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs';

/**
 * Renders attraction badges (icon + name) with overflow collapse.
 */
export const AttractionBadgesCell = ({
    attractions,
    maxVisible = 3
}: AttractionBadgesCellProps) => {
    if (!attractions || attractions.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    const visible = attractions.slice(0, maxVisible);
    const overflow = attractions.length - visible.length;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visible.map((attraction) => {
                const Icon = getAttractionIcon({ icon: attraction.icon });
                return (
                    <span
                        key={attraction.name}
                        className={PILL_CLASS}
                    >
                        <Icon
                            size={12}
                            weight="duotone"
                            duotoneColor="currentColor"
                            aria-hidden="true"
                        />
                        {attraction.name}
                    </span>
                );
            })}
            {overflow > 0 && <span className={cn(PILL_CLASS, 'text-foreground')}>+{overflow}</span>}
        </div>
    );
};
