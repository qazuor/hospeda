import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { getSponsorTypeColorScheme, getSponsorTypeIcon } from '@repo/icons';
import type { Sponsor } from '../schemas/sponsors.schemas';

/**
 * Maps each uppercase `ClientTypeEnum` value (sponsor classification) to its
 * i18n label key.
 */
const TYPE_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
    POST_SPONSOR: 'admin-entities.types.sponsor.postSponsor',
    ADVERTISER: 'admin-entities.types.sponsor.advertiser',
    HOST: 'admin-entities.types.sponsor.host'
};

/**
 * Type cell for the sponsors list: colored pill showing the sponsor-type
 * icon + localized label. Icon and color tokens come from the cross-app SSOT
 * in `@repo/icons`, so a type renders identically in admin and web.
 */
export const SponsorTypeBadge = ({ row }: { readonly row: Sponsor }) => {
    const { t } = useTranslations();
    const type = typeof row.type === 'string' ? row.type : '';

    if (!type) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = getSponsorTypeIcon({ type });
    const scheme = getSponsorTypeColorScheme({ type, variant: 'contrast' });
    const labelKey = TYPE_LABEL_KEYS[type.toUpperCase()];
    const label = labelKey ? t(labelKey) : type;

    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs"
            style={{
                backgroundColor: scheme.bg,
                color: scheme.text,
                borderColor: scheme.border
            }}
        >
            <Icon
                size={14}
                weight="duotone"
                duotoneColor="currentColor"
                aria-hidden="true"
            />
            {label}
        </span>
    );
};
