import type { TranslationKey } from '@repo/i18n';
import { useTranslations } from '@/hooks/use-translations';
import { DeadlineHalfSection } from './DeadlineHalfSection';

/** Composes the vertical and billing deadline halves on one admin screen. */
export function DeadlinesScreen() {
    const { t } = useTranslations();
    const translate = (key: string) => t(key as TranslationKey);
    return (
        <div
            className="space-y-6"
            data-testid="deadlines-screen"
        >
            <p>{translate('admin-billing.deadlinesEditor.intro')}</p>
            <p className="rounded-md bg-muted p-3">
                {translate('admin-billing.deadlinesEditor.clocksRule')}
            </p>
            <div className="grid gap-6 xl:grid-cols-2">
                <DeadlineHalfSection half="vertical" />
                <DeadlineHalfSection half="billing" />
            </div>
        </div>
    );
}
