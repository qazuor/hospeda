import { DockPortal } from '@/components/shared/dock/DockPortal';
import styles from '../FilterSidebar.module.css';

/** Props for the filter button rendered in the mobile dock. */
export interface FilterDockTriggerProps {
    readonly label: string;
    readonly activeCount: number;
    readonly isOpen: boolean;
    readonly onOpen: () => void;
}

/**
 * Keeps the compact filter action in the shared dock slot. Only this button
 * enters the portal: the drawer stays in FilterSidebar so its fixed overlay
 * is not captured by the dock row's backdrop-filter containing block.
 */
export function FilterDockTrigger({ label, activeCount, isOpen, onOpen }: FilterDockTriggerProps) {
    return (
        <DockPortal slot="filters">
            <button
                type="button"
                className={styles.floatingTrigger}
                onClick={onOpen}
                aria-label={label}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                data-dock-item
            >
                <span
                    className={styles.floatingTriggerIcon}
                    aria-hidden="true"
                >
                    ☰
                </span>
                <span>{label}</span>
                {activeCount > 0 && (
                    <span
                        className={styles.floatingBadge}
                        aria-hidden="true"
                    >
                        {activeCount}
                    </span>
                )}
            </button>
        </DockPortal>
    );
}
