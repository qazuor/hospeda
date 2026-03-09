/**
 * Profile page sub-components
 *
 * Reusable display components for the user profile page:
 * ProfileField, ProfileSection, and SocialLink.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { formatDate } from '@repo/i18n';
import type { ReactNode } from 'react';

/**
 * Displays a single profile field with label and value
 */
export function ProfileField({
    label,
    value,
    type = 'text'
}: {
    readonly label: string;
    readonly value: string | null | undefined;
    readonly type?: 'text' | 'email' | 'url' | 'date';
}) {
    const { t, locale } = useTranslations();
    const formattedValue = (() => {
        if (!value) return null;

        if (type === 'date') {
            try {
                return formatDate({
                    date: value,
                    locale,
                    options: { year: 'numeric', month: 'long', day: 'numeric' }
                });
            } catch {
                return value;
            }
        }

        return value;
    })();

    const renderValue = () => {
        if (!formattedValue) {
            return (
                <span className="text-muted-foreground text-sm italic">
                    {t('admin-pages.profile.fieldNotSet')}
                </span>
            );
        }

        if (type === 'email') {
            return (
                <a
                    href={`mailto:${formattedValue}`}
                    className="text-primary text-sm hover:underline"
                >
                    {formattedValue}
                </a>
            );
        }

        if (type === 'url') {
            return (
                <a
                    href={formattedValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm hover:underline"
                >
                    {formattedValue}
                </a>
            );
        }

        return <p className="text-sm">{formattedValue}</p>;
    };

    return (
        <div>
            <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                {label}
            </span>
            {renderValue()}
        </div>
    );
}

/**
 * Profile section card with colored icon header
 */
export function ProfileSection({
    title,
    subtitle,
    icon,
    iconColorClass,
    children
}: {
    readonly title: string;
    readonly subtitle: string;
    readonly icon: ReactNode;
    readonly iconColorClass: string;
    readonly children: ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconColorClass}`}
                    >
                        {icon}
                    </div>
                    <div>
                        <CardTitle className="text-lg">{title}</CardTitle>
                        <p className="text-muted-foreground text-sm">{subtitle}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">{children}</div>
            </CardContent>
        </Card>
    );
}

/**
 * Social network link display
 */
export function SocialLink({
    label,
    url,
    icon
}: {
    readonly label: string;
    readonly url: string | null | undefined;
    readonly icon: ReactNode;
}) {
    const { t } = useTranslations();
    if (!url) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-sm italic">{t('admin-pages.profile.social.notSet')}</span>
            </div>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary text-sm hover:underline"
        >
            {icon}
            {label}
        </a>
    );
}
