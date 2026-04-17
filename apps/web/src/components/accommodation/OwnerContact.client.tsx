import { GradientButton } from '@/components/ui/GradientButtonReact';
/**
 * @file OwnerContact.client.tsx
 * @description Auth-aware React island for displaying accommodation contact info.
 * If userId is null, renders nothing (Astro wrapper shows register CTA).
 * If userId is set, fetches contact from protected endpoint and renders buttons.
 */
import { protectedAccommodationsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import styles from './OwnerContact.module.css';

interface OwnerContactProps {
    readonly userId: string | null;
    readonly accommodationId: string;
    readonly locale: SupportedLocale;
}

interface ContactData {
    readonly email?: string;
    readonly phone?: string;
    readonly website?: string;
}

export function OwnerContact({ userId, accommodationId, locale }: OwnerContactProps) {
    const { t } = createTranslations(locale);
    const [contact, setContact] = useState<ContactData | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userId) return;

        let cancelled = false;
        setLoading(true);

        protectedAccommodationsApi
            .getContactInfo({ id: accommodationId })
            .then((result) => {
                if (cancelled) return;
                if (result.ok && result.data) {
                    setContact(result.data as ContactData);
                } else {
                    setError(true);
                }
            })
            .catch(() => {
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [userId, accommodationId]);

    if (!userId) return null;

    if (loading) {
        return <div className={styles.loading}>...</div>;
    }

    if (error || !contact) {
        return (
            <p className={styles.unavailable}>
                {t('accommodations.detail.owner.contactUnavailable')}
            </p>
        );
    }

    const hasAnyContact = contact.email || contact.phone || contact.website;
    if (!hasAnyContact) {
        return (
            <p className={styles.unavailable}>
                {t('accommodations.detail.owner.contactUnavailable')}
            </p>
        );
    }

    return (
        <div className={styles.buttons}>
            {contact.email && (
                <GradientButton
                    href={`mailto:${contact.email}`}
                    label={t('accommodations.detail.owner.contactEmail')}
                    variant="outline-primary"
                    size="sm"
                    shape="rounded"
                />
            )}
            {contact.phone && (
                <GradientButton
                    href={`tel:${contact.phone}`}
                    label={t('accommodations.detail.owner.contactPhone')}
                    variant="outline-primary"
                    size="sm"
                    shape="rounded"
                />
            )}
            {contact.website && (
                <GradientButton
                    href={contact.website}
                    label={t('accommodations.detail.owner.contactWebsite')}
                    variant="outline-primary"
                    size="sm"
                    shape="rounded"
                    target="_blank"
                    rel="noopener noreferrer"
                />
            )}
        </div>
    );
}
