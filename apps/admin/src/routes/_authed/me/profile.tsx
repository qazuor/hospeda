/**
 * My Profile Page Route
 *
 * Displays current user's profile information.
 * Profile data is managed through Clerk authentication provider.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink, Mail, Shield, User } from 'lucide-react';

export const Route = createFileRoute('/_authed/me/profile')({
    component: MyProfilePage
});

function MyProfilePage() {
    const { t } = useTranslations();

    return (
        <MainPageLayout title={t('ui.pages.myProfile')}>
            <div className="mx-auto max-w-4xl space-y-6">
                {/* Profile header card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                            {/* Avatar placeholder */}
                            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-3xl text-primary-foreground">
                                U
                            </div>

                            {/* Profile info */}
                            <div className="flex-1 space-y-3 text-center sm:text-left">
                                <div>
                                    <h2 className="mb-1 font-bold text-2xl">Current User</h2>
                                    <p className="text-muted-foreground text-sm">
                                        Your profile is managed through Clerk authentication
                                    </p>
                                </div>

                                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                                    <Badge
                                        variant="secondary"
                                        className="gap-1"
                                    >
                                        <Shield className="h-3 w-3" />
                                        Clerk Authentication
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Profile sections */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Basic info */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                    <User className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Basic Information</CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        Your account details
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div>
                                    <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                        Display Name
                                    </span>
                                    <p className="font-medium">Managed by Clerk</p>
                                </div>
                                <div>
                                    <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                        Username
                                    </span>
                                    <p className="font-medium">Managed by Clerk</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact info */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                                    <Mail className="h-5 w-5 text-green-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Contact Information</CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        Your email address
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div>
                                    <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                        Email Address
                                    </span>
                                    <p className="font-medium">Managed by Clerk</p>
                                </div>
                                <div>
                                    <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                        Email Status
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="gap-1"
                                    >
                                        Verified by Clerk
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bio section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">About</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div>
                                <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                    Bio
                                </span>
                                <p className="text-muted-foreground text-sm">
                                    Profile bio and description will be available once user settings
                                    are integrated with the backend API.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Info cards */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Authentication provider info */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                        <div className="mb-2 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                            <p className="font-medium text-blue-900 text-sm dark:text-blue-100">
                                Clerk Authentication
                            </p>
                        </div>
                        <p className="mb-3 text-blue-900 text-sm dark:text-blue-100">
                            Your profile information is securely managed through Clerk. To update
                            your personal details, email, or password, use the Clerk dashboard.
                        </p>
                        <a
                            href="https://dashboard.clerk.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 text-sm underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                        >
                            Open Clerk Dashboard
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>

                    {/* Future features */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                        <div className="mb-2 flex items-center gap-2">
                            <User className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                            <p className="font-medium text-amber-900 text-sm dark:text-amber-100">
                                Profile Settings
                            </p>
                        </div>
                        <p className="text-amber-900 text-sm dark:text-amber-100">
                            Advanced profile customization and preferences will be available once
                            the user settings API is implemented. This will include bio, avatar,
                            timezone, and notification preferences.
                        </p>
                    </div>
                </div>
            </div>
        </MainPageLayout>
    );
}
