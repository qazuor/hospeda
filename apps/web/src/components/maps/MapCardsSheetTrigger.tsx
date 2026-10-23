import { DockPortal } from '@/components/shared/dock/DockPortal';
import sidebarStyles from './MapCardsSidebar.module.css';

/** Props for the mobile map cards sheet button. */
export interface MapCardsSheetTriggerProps {
    readonly label: string;
    readonly isSheetOpen: boolean;
    readonly onOpen: () => void;
}

/**
 * Portals only the map CTA into the dock. The sheet and backdrop stay in
 * MapCardsSidebar because the dock row's backdrop-filter captures fixed
 * descendants and would change their viewport positioning.
 */
export function MapCardsSheetTrigger({ label, isSheetOpen, onOpen }: MapCardsSheetTriggerProps) {
    return (
        <DockPortal slot="map-cards">
            <button
                type="button"
                className={sidebarStyles.sheetTrigger}
                onClick={onOpen}
                aria-expanded={isSheetOpen}
                aria-controls="map-cards-sheet"
                data-dock-item
            >
                {label}
            </button>
        </DockPortal>
    );
}
