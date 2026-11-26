import { CloseIcon } from '@repo/icons';
import { useId, useLayoutEffect, useRef } from 'react';
import styles from './DestinationMapCard.module.css';
import type { DestinationListingItem } from './ListingMap.client';
import popupStyles from './ListingMap.module.css';

interface Props {
    readonly item: DestinationListingItem;
    readonly closeLabel: string;
    readonly viewDetailsLabel: string;
    readonly onClose: () => void;
}

/** Presents the selected destination outside Leaflet and focuses its named region on mount. */
export function DestinationMapCard({ item, closeLabel, viewDetailsLabel, onClose }: Props) {
    const titleId = useId();
    const cardRef = useRef<HTMLElement>(null);

    useLayoutEffect(() => {
        cardRef.current?.focus();
    }, []);

    return (
        <section
            ref={cardRef}
            className={styles.destinationSelection}
            aria-labelledby={titleId}
            tabIndex={-1}
        >
            {item.thumbnailUrl ? (
                <div className={styles.popupImageWrapper}>
                    <img
                        src={item.thumbnailUrl}
                        alt=""
                        className={styles.popupImage}
                    />
                </div>
            ) : null}
            <div className={`${popupStyles.popupBody} ${styles.body}`}>
                <h3
                    id={titleId}
                    className={popupStyles.popupTitle}
                >
                    {item.name}
                </h3>
                {item.description ? (
                    <p className={popupStyles.popupCity}>{item.description}</p>
                ) : null}
                {item.accommodationsLabel ? (
                    <p className={popupStyles.popupCity}>{item.accommodationsLabel}</p>
                ) : null}
                {item.detailHref ? (
                    <a
                        href={item.detailHref}
                        className={`${popupStyles.popupCta} ${styles.detailsLink}`}
                    >
                        {viewDetailsLabel}
                    </a>
                ) : null}
            </div>
            <button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label={closeLabel}
            >
                <CloseIcon
                    size="sm"
                    aria-hidden="true"
                />
            </button>
        </section>
    );
}
