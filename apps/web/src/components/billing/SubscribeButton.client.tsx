import { useEffect, useMemo, useRef, useState } from 'react';
import { type PublishVerticalSlug, publishApi } from '@/lib/api/endpoints-protected';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import {
    resolveSubscribeButtonView,
    type SubscribeButtonView
} from '@/lib/publish/subscribe-button';
import styles from './SubscribeButton.module.css';

export interface SubscribeButtonProps {
    readonly locale: SupportedLocale;
    readonly vertical: PublishVerticalSlug;
}

export function SubscribeButton({ locale, vertical }: SubscribeButtonProps) {
    const [view, setView] = useState<SubscribeButtonView | null>(null);
    const requested = useRef(false);
    const { t, tPlural } = useMemo(() => createTranslations(locale), [locale]);

    useEffect(() => {
        if (requested.current) return;
        requested.current = true;
        void publishApi.subscribeDestination({ vertical }).then((result) => {
            setView(resolveSubscribeButtonView({ locale, vertical, result }));
        });
    }, [locale, vertical]);

    if (!view || view.kind === 'hidden' || view.kind === 'covered') return null;

    if (view.kind === 'noPlans') {
        return (
            <section
                className={styles.message}
                data-testid="subscribe-button"
                data-destination="no-plans"
            >
                <h2>{t('publish.noPlans.title')}</h2>
                <p>{t('publish.noPlans.body')}</p>
            </section>
        );
    }

    if (view.kind === 'checkout') {
        return (
            <div
                data-testid="subscribe-button"
                data-destination="checkout"
            />
        );
    }

    if (view.kind === 'signedOut') {
        return (
            <div
                className={styles.container}
                data-testid="subscribe-button"
                data-destination="signed-out"
            >
                <a
                    className={styles.primary}
                    href={view.href}
                >
                    {t('publish.subscribe.publishCta')}
                </a>
            </div>
        );
    }

    return (
        <div
            className={styles.container}
            data-testid="subscribe-button"
            data-destination="publish"
        >
            <a
                className={styles.primary}
                href={view.href}
            >
                {t('publish.subscribe.publishCta')}
            </a>
            <p className={styles.note}>
                {tPlural('publish.subscribe.trialNote', view.trialDays, {
                    trialDays: view.trialDays
                })}
            </p>
        </div>
    );
}
