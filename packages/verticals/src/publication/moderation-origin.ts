import { PublicationStatusEnum } from '@repo/schemas';
import type { PublicationModerationOrigin } from './publication-types';

/** Selects the only permitted lift transition for a recorded moderation origin. */
export function resolveLiftTransition(args: {
    readonly origin: PublicationModerationOrigin | null;
}): 'PB11' | 'PB13' {
    if (!args.origin) return 'PB11';
    const origin =
        args.origin.from === PublicationStatusEnum.ARCHIVED
            ? args.origin.archiveOrigin
            : args.origin.from;
    switch (origin) {
        case PublicationStatusEnum.PUBLISHED:
        case PublicationStatusEnum.UNPUBLISHED_BY_BILLING:
            return 'PB13';
        case PublicationStatusEnum.DRAFT:
        case PublicationStatusEnum.ARCHIVED:
        case PublicationStatusEnum.MODERATED:
        case PublicationStatusEnum.PURGED:
        case null:
            return 'PB11';
        default: {
            const exhaustive: never = origin;
            return exhaustive;
        }
    }
}
