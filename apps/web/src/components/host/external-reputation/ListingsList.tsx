/**
 * @file ListingsList.tsx
 * @description The connected sources: a kit `DataList` with one row per
 * listing (HOS-2515). Each row shows the platform, its run status, the FULL
 * URL (wrapped, never truncated), two visibility switches and a remove button.
 *
 * The switches are kit `SwitchRow`s: they save on their own, revert when the
 * save fails and say so. The caller wires them to the editor's auto-save chip.
 */

import type { ReactElement } from 'react';
import { Button } from '@/components/account/ui/Button';
import { DataList } from '@/components/account/ui/DataList';
import { SwitchRow } from '@/components/account/ui/Switch';
import type { ReputationPlatformStatus } from '@/hooks/use-reputation-status';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './ExternalReputation.module.css';
import type {
    ExternalListingRow,
    ExternalPlatform,
    ListingToggleField
} from './external-reputation-types';
import { ListingStatus } from './ListingStatus';

/** Props of {@link ListingsList}. */
export interface ListingsListProps {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    readonly listings: readonly ExternalListingRow[];
    /** Status snapshots keyed by platform. */
    readonly statuses: Readonly<Partial<Record<string, ReputationPlatformStatus>>>;
    /** Saves one flag of one listing; rejects on failure. */
    readonly onFlagChange: (input: {
        readonly listingId: string;
        readonly field: ListingToggleField;
        readonly next: boolean;
    }) => Promise<void>;
    /** Asks to remove a listing (the caller confirms first). */
    readonly onRemove: (listing: ExternalListingRow) => void;
}

/**
 * Resolves the display name of a platform.
 *
 * @param params - The `t` function and the platform.
 * @returns The translated platform name.
 */
export function platformLabel({
    t,
    platform
}: {
    readonly t: TranslationFn;
    readonly platform: ExternalPlatform;
}): string {
    return t(`external-reputation.platform.${platform.toLowerCase()}`);
}

/**
 * The list of connected sources.
 *
 * @param props - See {@link ListingsListProps}.
 * @returns A kit `DataList`.
 */
export function ListingsList({
    locale,
    t,
    listings,
    statuses,
    onFlagChange,
    onRemove
}: ListingsListProps): ReactElement {
    return (
        <DataList label={t('external-reputation.ownerConfig.listLabel')}>
            {listings.map((listing) => {
                const name = platformLabel({ t, platform: listing.platform });
                return (
                    <li
                        key={listing.id}
                        className={styles.listingRow}
                    >
                        <div className={styles.rowHead}>
                            <span className={styles.platform}>{name}</span>
                            <ListingStatus
                                status={statuses[listing.platform]}
                                t={t}
                            />
                            <span className={styles.removeSlot}>
                                <Button
                                    variant="danger-ghost"
                                    size="sm"
                                    aria-label={t(
                                        'external-reputation.ownerConfig.removeLabel',
                                        undefined,
                                        {
                                            platform: name
                                        }
                                    )}
                                    onClick={() => onRemove(listing)}
                                >
                                    {t('external-reputation.ownerConfig.removeButton')}
                                </Button>
                            </span>
                        </div>
                        <p className={styles.url}>{listing.url}</p>
                        <fieldset className={styles.toggles}>
                            <legend className={styles.srOnly}>{name}</legend>
                            <SwitchRow
                                locale={locale}
                                label={t('external-reputation.ownerConfig.showLink')}
                                checked={listing.showLink}
                                onChange={(next) =>
                                    onFlagChange({ listingId: listing.id, field: 'showLink', next })
                                }
                            />
                            <SwitchRow
                                locale={locale}
                                label={t('external-reputation.ownerConfig.showReviews')}
                                checked={listing.showReviews}
                                onChange={(next) =>
                                    onFlagChange({
                                        listingId: listing.id,
                                        field: 'showReviews',
                                        next
                                    })
                                }
                            />
                        </fieldset>
                    </li>
                );
            })}
        </DataList>
    );
}
