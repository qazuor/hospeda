import { useTranslations } from '@/hooks/use-translations';
import { GRANT_REFUSAL_KEYS, readGrantRefusal } from '../grant-refusals';

export function GrantRefusal({ error }: { error: unknown }) {
    const { t } = useTranslations();
    const reason = readGrantRefusal(error);
    return (
        <p
            role="alert"
            data-testid="permanent-grant-refusal"
        >
            {reason && GRANT_REFUSAL_KEYS[reason]
                ? t(GRANT_REFUSAL_KEYS[reason])
                : reason
                  ? t('admin-billing.permanentGrants.unknownRefusal', { reason })
                  : t('admin-billing.permanentGrants.loadError')}
        </p>
    );
}
