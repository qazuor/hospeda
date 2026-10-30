import { MapIcon } from '@repo/icons';
import { DockPortal } from '@/components/shared/dock/DockPortal';
import sidebarStyles from './MapCardsSidebar.module.css';

/** Props for the mobile map cards sheet button. */
export interface MapCardsSheetTriggerProps {
    /** Full label ("Ver 12 resultados"). Always the button's accessible name. */
    readonly label: string;
    /** Short visible label ("12 resultados") used where the full one does not fit. */
    readonly shortLabel?: string;
    /** Result count shown next to an icon on the narrowest phones. */
    readonly count?: number;
    readonly isSheetOpen: boolean;
    readonly onOpen: () => void;
}

/**
 * Portals only the map CTA into the dock. The sheet and backdrop stay in
 * MapCardsSidebar because the dock row's backdrop-filter captures fixed
 * descendants and would change their viewport positioning.
 *
 * HOS-1780: the dock must stay on one row, so the visible text degrades with
 * the viewport (full label, short label, icon + count) through CSS only. The
 * `aria-label` carries the full label in every mode, and each visible part
 * is `aria-hidden` so nothing is announced twice.
 */
export function MapCardsSheetTrigger({
    label,
    shortLabel,
    count,
    isSheetOpen,
    onOpen
}: MapCardsSheetTriggerProps) {
    return (
        <DockPortal slot="map-cards">
            <button
                type="button"
                className={sidebarStyles.sheetTrigger}
                onClick={onOpen}
                aria-label={label}
                aria-expanded={isSheetOpen}
                aria-controls="map-cards-sheet"
                data-dock-item
            >
                <span
                    className={sidebarStyles.sheetTriggerFull}
                    aria-hidden="true"
                    data-sheet-trigger-part="full"
                >
                    {label}
                </span>
                <span
                    className={sidebarStyles.sheetTriggerShort}
                    aria-hidden="true"
                    data-sheet-trigger-part="short"
                >
                    {shortLabel ?? label}
                </span>
                <span
                    className={sidebarStyles.sheetTriggerCount}
                    aria-hidden="true"
                    data-sheet-trigger-part="count"
                >
                    <MapIcon
                        size={16}
                        weight="bold"
                        aria-hidden="true"
                    />
                    <span>{count ?? shortLabel ?? label}</span>
                </span>
            </button>
        </DockPortal>
    );
}
