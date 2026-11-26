import { DockPortal } from '@/components/shared/dock/DockPortal';
import sidebarStyles from './MapCardsSidebar.module.css';

/** Props for the mobile map cards sheet button. */
export interface MapCardsSheetTriggerProps {
    /** Full label ("Ver 12 resultados"). Always the button's accessible name. */
    readonly label: string;
    /** Short visible label ("12 resultados") used where the full one does not fit. */
    readonly shortLabel?: string;
    readonly isSheetOpen: boolean;
    readonly onOpen: () => void;
}

/**
 * Portals only the map CTA into the dock. The sheet and backdrop stay in
 * MapCardsSidebar because the dock row's backdrop-filter captures fixed
 * descendants and would change their viewport positioning.
 *
 * The dock stays on one row; the button text may wrap inside the button.
 */
export function MapCardsSheetTrigger({
    label,
    shortLabel,
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
            </button>
        </DockPortal>
    );
}
