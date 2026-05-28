import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { getAuthProviderColorScheme, getAuthProviderIcon } from '@repo/icons';
import type { User } from '../schemas/users.schemas';

/**
 * Maps each uppercase `AuthProviderEnum` value to its i18n label key. Spelled
 * out (not built via template literals) so they stay within the generated
 * `TranslationKey` union.
 */
const PROVIDER_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
    LOCAL: 'admin-entities.types.authProvider.local',
    GOOGLE: 'admin-entities.types.authProvider.google',
    FACEBOOK: 'admin-entities.types.authProvider.facebook',
    GITHUB: 'admin-entities.types.authProvider.github',
    BETTER_AUTH: 'admin-entities.types.authProvider.betterAuth'
};

/**
 * Auth-provider cell for the users list: a colored pill showing the provider
 * brand mark + localized label. The icon and color tokens come from the
 * cross-app single source of truth in `@repo/icons`, so a provider renders
 * identically in admin and web. Read-only — auth provider is signup metadata,
 * not editable.
 */
export const AuthProviderBadge = ({ row }: { readonly row: User }) => {
    const { t } = useTranslations();
    const provider = typeof row.authProvider === 'string' ? row.authProvider : '';

    if (!provider) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = getAuthProviderIcon({ provider });
    const scheme = getAuthProviderColorScheme({ provider, variant: 'contrast' });
    const labelKey = PROVIDER_LABEL_KEYS[provider.toUpperCase()];
    const label = labelKey ? t(labelKey) : provider;

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
