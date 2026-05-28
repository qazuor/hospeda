import { getAttractionIcon } from '@repo/icons';

interface AttractionIconCellProps {
    /** Material Symbols slug (e.g. `"nature_reserve"`, `"hiking"`). */
    readonly iconSlug: string | null | undefined;
}

/**
 * Renders an attraction's material-symbols `icon` slug as the corresponding
 * Phosphor component via the cross-app SSOT in `@repo/icons`. Shows the slug
 * in monospace next to the icon for identification. Falls back to a plain
 * em-dash on missing slugs.
 */
export const AttractionIconCell = ({ iconSlug }: AttractionIconCellProps) => {
    if (!iconSlug) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = getAttractionIcon({ icon: iconSlug });

    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon
                size={18}
                weight="duotone"
                aria-hidden="true"
            />
            <span className="font-mono text-muted-foreground text-xs">{iconSlug}</span>
        </span>
    );
};
