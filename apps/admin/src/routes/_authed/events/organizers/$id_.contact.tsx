/**
 * Event Organizer Contact Tab Route
 *
 * Displays contact information for a specific event organizer.
 */

import { PageTabs, eventOrganizerTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventOrganizerQuery } from '@/features/event-organizers/hooks/useEventOrganizerQuery';
import { useTranslations } from '@/hooks/use-translations';
import { GlobeIcon, MailIcon, PhoneIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/organizers/$id_/contact')({
    component: EventOrganizerContactPage
});

function EventOrganizerContactPage() {
    const { t } = useTranslations();
    const { id } = Route.useParams();
    const { data: organizer, isLoading } = useEventOrganizerQuery(id);

    if (isLoading) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.eventOrganizers">
                <div className="space-y-4">
                    <PageTabs
                        tabs={eventOrganizerTabs}
                        basePath={`/events/organizers/${id}`}
                    />
                    <div className="rounded-lg border bg-card p-6">
                        <div className="space-y-4">
                            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
                            <div className="h-32 animate-pulse rounded bg-muted" />
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    const contactInfo = organizer?.contactInfo;
    const socialNetworks = organizer?.socialNetworks;

    const email = contactInfo?.personalEmail || contactInfo?.workEmail;
    const phone = contactInfo?.mobilePhone || contactInfo?.homePhone || contactInfo?.workPhone;
    const website = contactInfo?.website;

    const hasContactInfo = email || phone || website;
    const hasSocialInfo =
        socialNetworks?.twitter ||
        socialNetworks?.facebook ||
        socialNetworks?.instagram ||
        socialNetworks?.linkedIn;

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.eventOrganizers">
            <div className="space-y-4">
                <PageTabs
                    tabs={eventOrganizerTabs}
                    basePath={`/events/organizers/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">
                        {t('admin-pages.eventOrganizers.contact.contactSection')}
                    </h2>

                    <div className="space-y-4">
                        {/* Contact Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    {t('admin-pages.eventOrganizers.contact.contactInfo')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!hasContactInfo && (
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-pages.eventOrganizers.contact.noContactInfo')}
                                    </p>
                                )}

                                {email && (
                                    <div className="flex items-center gap-3">
                                        <MailIcon className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <span className="mb-1 block font-medium text-sm">
                                                {t('admin-pages.eventOrganizers.contact.email')}
                                            </span>
                                            <a
                                                href={`mailto:${email}`}
                                                className="text-primary text-sm hover:underline"
                                            >
                                                {email}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {phone && (
                                    <div className="flex items-center gap-3">
                                        <PhoneIcon className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <span className="mb-1 block font-medium text-sm">
                                                {t('admin-pages.eventOrganizers.contact.phone')}
                                            </span>
                                            <a
                                                href={`tel:${phone}`}
                                                className="text-primary text-sm hover:underline"
                                            >
                                                {phone}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {website && (
                                    <div className="flex items-center gap-3">
                                        <GlobeIcon className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <span className="mb-1 block font-medium text-sm">
                                                {t('admin-pages.eventOrganizers.contact.website')}
                                            </span>
                                            <a
                                                href={website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary text-sm hover:underline"
                                            >
                                                {website}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Social Networks */}
                        {hasSocialInfo && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {t('admin-pages.eventOrganizers.contact.socialNetworks')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {socialNetworks?.twitter && (
                                            <div className="rounded-md border p-3">
                                                <span className="mb-1 block font-medium text-sm">
                                                    Twitter
                                                </span>
                                                <a
                                                    href={socialNetworks.twitter}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary text-sm hover:underline"
                                                >
                                                    {socialNetworks.twitter}
                                                </a>
                                            </div>
                                        )}
                                        {socialNetworks?.facebook && (
                                            <div className="rounded-md border p-3">
                                                <span className="mb-1 block font-medium text-sm">
                                                    Facebook
                                                </span>
                                                <a
                                                    href={socialNetworks.facebook}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary text-sm hover:underline"
                                                >
                                                    {socialNetworks.facebook}
                                                </a>
                                            </div>
                                        )}
                                        {socialNetworks?.instagram && (
                                            <div className="rounded-md border p-3">
                                                <span className="mb-1 block font-medium text-sm">
                                                    Instagram
                                                </span>
                                                <a
                                                    href={socialNetworks.instagram}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary text-sm hover:underline"
                                                >
                                                    {socialNetworks.instagram}
                                                </a>
                                            </div>
                                        )}
                                        {socialNetworks?.linkedIn && (
                                            <div className="rounded-md border p-3">
                                                <span className="mb-1 block font-medium text-sm">
                                                    LinkedIn
                                                </span>
                                                <a
                                                    href={socialNetworks.linkedIn}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary text-sm hover:underline"
                                                >
                                                    {socialNetworks.linkedIn}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
