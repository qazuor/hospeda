/**
 * My Profile Page Route
 *
 * Displays the current user's profile information fetched from
 * the protected API endpoint. All sections are read-only.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserDisplayName, useUserInitials } from '@/hooks/use-auth';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useSession } from '@/lib/auth-client';
import {
    FacebookIcon,
    InstagramIcon,
    LocationIcon,
    MailIcon,
    ShieldIcon,
    UserIcon,
    WebIcon
} from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export const Route = createFileRoute('/_authed/me/profile')({
    component: MyProfilePage
});

/**
 * Displays a single profile field with label and value
 */
function ProfileField({
    label,
    value,
    type = 'text'
}: {
    readonly label: string;
    readonly value: string | null | undefined;
    readonly type?: 'text' | 'email' | 'url' | 'date';
}) {
    const formattedValue = (() => {
        if (!value) return null;

        if (type === 'date') {
            try {
                return new Date(value).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch {
                return value;
            }
        }

        return value;
    })();

    const renderValue = () => {
        if (!formattedValue) {
            return <span className="text-muted-foreground text-sm italic">Not set</span>;
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
function ProfileSection({
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
function SocialLink({
    label,
    url,
    icon
}: {
    readonly label: string;
    readonly url: string | null | undefined;
    readonly icon: ReactNode;
}) {
    if (!url) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-sm italic">Not set</span>
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

function MyProfilePage() {
    const { t } = useTranslations();
    const { user: authUser } = useAuthContext();
    const { data: session } = useSession();
    const displayName = useUserDisplayName();
    const initials = useUserInitials();

    const { data: profile, isLoading, error, refetch } = useUserProfile({ userId: authUser?.id });

    // Loading state
    if (isLoading) {
        return (
            <MainPageLayout title={t('ui.pages.myProfile')}>
                <div className="mx-auto max-w-4xl space-y-6">
                    {/* Header skeleton */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                                <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-7 w-48 animate-pulse rounded bg-muted" />
                                    <div className="h-4 w-64 animate-pulse rounded bg-muted" />
                                    <div className="flex gap-2">
                                        <div className="h-6 w-20 animate-pulse rounded bg-muted" />
                                        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Section skeletons */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i}>
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                                        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                                        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </MainPageLayout>
        );
    }

    // Error state
    if (error) {
        return (
            <MainPageLayout title={t('ui.pages.myProfile')}>
                <div className="mx-auto max-w-4xl">
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="mb-2 font-medium text-destructive">
                                Failed to load profile
                            </p>
                            <p className="mb-4 text-muted-foreground text-sm">{error.message}</p>
                            <Button
                                variant="outline"
                                onClick={() => refetch()}
                            >
                                Retry
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </MainPageLayout>
        );
    }

    const avatarUrl = session?.user?.image ?? profile?.avatarUrl;
    const email = session?.user?.email ?? authUser?.email ?? profile?.email;
    const emailVerified = session?.user?.emailVerified ?? false;
    const role = authUser?.role ?? profile?.role;
    const permissions = authUser?.permissions ?? profile?.permissions ?? [];

    return (
        <MainPageLayout title={t('ui.pages.myProfile')}>
            <div className="mx-auto max-w-4xl space-y-6">
                {/* Header card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                            {/* Avatar */}
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={displayName}
                                    className="h-20 w-20 flex-shrink-0 rounded-full object-cover"
                                />
                            ) : (
                                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-3xl text-primary-foreground">
                                    {initials}
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 space-y-3 text-center sm:text-left">
                                <div>
                                    <h2 className="mb-1 font-bold text-2xl">{displayName}</h2>
                                    {email && (
                                        <p className="text-muted-foreground text-sm">{email}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                                    {role && (
                                        <Badge
                                            variant="secondary"
                                            className="gap-1"
                                        >
                                            <ShieldIcon className="h-3 w-3" />
                                            {role}
                                        </Badge>
                                    )}
                                    {emailVerified ? (
                                        <Badge
                                            variant="outline"
                                            className="gap-1 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                                        >
                                            Email verified
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="outline"
                                            className="gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                                        >
                                            Email not verified
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Profile sections grid */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Personal info */}
                    <ProfileSection
                        title="Personal Information"
                        subtitle="Your account details"
                        icon={<UserIcon className="h-5 w-5 text-blue-500" />}
                        iconColorClass="bg-blue-500/10"
                    >
                        <ProfileField
                            label="Display Name"
                            value={profile?.displayName}
                        />
                        <ProfileField
                            label="First Name"
                            value={profile?.firstName}
                        />
                        <ProfileField
                            label="Last Name"
                            value={profile?.lastName}
                        />
                        <ProfileField
                            label="Birth Date"
                            value={profile?.birthDate?.toString()}
                            type="date"
                        />
                        <ProfileField
                            label="Slug"
                            value={profile?.slug}
                        />
                        <ProfileField
                            label="Bio"
                            value={profile?.profile?.bio}
                        />
                        <ProfileField
                            label="Occupation"
                            value={profile?.profile?.occupation}
                        />
                    </ProfileSection>

                    {/* Contact info */}
                    <ProfileSection
                        title="Contact Information"
                        subtitle="Your contact details"
                        icon={<MailIcon className="h-5 w-5 text-green-500" />}
                        iconColorClass="bg-green-500/10"
                    >
                        <ProfileField
                            label="Email"
                            value={email}
                            type="email"
                        />
                        <ProfileField
                            label="Phone"
                            value={profile?.phone}
                        />
                        <ProfileField
                            label="Phone (Secondary)"
                            value={profile?.phoneSecondary}
                        />
                        <ProfileField
                            label="Website"
                            value={profile?.website}
                            type="url"
                        />
                    </ProfileSection>

                    {/* Location */}
                    <ProfileSection
                        title="Location"
                        subtitle="Your address information"
                        icon={<LocationIcon className="h-5 w-5 text-purple-500" />}
                        iconColorClass="bg-purple-500/10"
                    >
                        <ProfileField
                            label="Address Line 1"
                            value={profile?.addressLine1}
                        />
                        <ProfileField
                            label="Address Line 2"
                            value={profile?.addressLine2}
                        />
                        <ProfileField
                            label="City"
                            value={profile?.city}
                        />
                        <ProfileField
                            label="Province"
                            value={profile?.province}
                        />
                        <ProfileField
                            label="Country"
                            value={profile?.country}
                        />
                        <ProfileField
                            label="Postal Code"
                            value={profile?.postalCode}
                        />
                    </ProfileSection>

                    {/* Social Networks */}
                    <ProfileSection
                        title="Social Networks"
                        subtitle="Your social media links"
                        icon={<WebIcon className="h-5 w-5 text-indigo-500" />}
                        iconColorClass="bg-indigo-500/10"
                    >
                        <SocialLink
                            label="Facebook"
                            url={profile?.facebookUrl}
                            icon={<FacebookIcon className="h-4 w-4" />}
                        />
                        <SocialLink
                            label="Instagram"
                            url={profile?.instagramUrl}
                            icon={<InstagramIcon className="h-4 w-4" />}
                        />
                        <SocialLink
                            label="Twitter"
                            url={profile?.twitterUrl}
                            icon={<WebIcon className="h-4 w-4" />}
                        />
                        <SocialLink
                            label="LinkedIn"
                            url={profile?.linkedinUrl}
                            icon={<WebIcon className="h-4 w-4" />}
                        />
                        <SocialLink
                            label="YouTube"
                            url={profile?.youtubeUrl}
                            icon={<WebIcon className="h-4 w-4" />}
                        />
                    </ProfileSection>
                </div>

                {/* Account Security */}
                <ProfileSection
                    title="Account Security"
                    subtitle="Authentication and permissions"
                    icon={<ShieldIcon className="h-5 w-5 text-amber-500" />}
                    iconColorClass="bg-amber-500/10"
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                Email Verified
                            </span>
                            {emailVerified ? (
                                <Badge
                                    variant="outline"
                                    className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                                >
                                    Verified
                                </Badge>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                                >
                                    Not verified
                                </Badge>
                            )}
                        </div>
                        <ProfileField
                            label="Role"
                            value={role}
                        />
                        <ProfileField
                            label="Permissions"
                            value={`${permissions.length} permission${permissions.length !== 1 ? 's' : ''} assigned`}
                        />
                        <ProfileField
                            label="Auth Provider"
                            value="Better Auth"
                        />
                    </div>
                </ProfileSection>
            </div>
        </MainPageLayout>
    );
}
