import { resolveIcon } from '@repo/icons';

interface IconNameCellProps {
    /** Icon component name (e.g. `"WifiIcon"`, `"PoolIcon"`). */
    readonly iconName: string | null | undefined;
}

/**
 * Renders a stored icon-component-name slug as the actual icon component, with
 * the slug shown next to it for debugging/identification. Falls back to a plain
 * em-dash when the icon name is empty or unknown.
 *
 * Used in catalog lists (amenities/features) where rows store the icon name on
 * the `icon` field.
 */
export const IconNameCell = ({ iconName }: IconNameCellProps) => {
    if (!iconName) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = resolveIcon({ iconName });

    if (!Icon) {
        return <span className="font-mono text-muted-foreground text-xs">{iconName}</span>;
    }

    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon
                size={18}
                weight="duotone"
                aria-hidden="true"
            />
            <span className="font-mono text-muted-foreground text-xs">{iconName}</span>
        </span>
    );
};
