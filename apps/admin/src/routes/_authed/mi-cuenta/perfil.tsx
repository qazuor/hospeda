/**
 * My Profile Page Route
 *
 * Editable profile form (SPEC-096 / REQ-096-31, T-055).
 *
 * Validates input against `ProfileEditSchema` from `@repo/schemas` and
 * submits via `useUpdateUserProfile`, which PATCHes
 * `/api/v1/admin/users/{id}` mapping flat profile-edit fields onto the
 * nested user shape (top-level for displayName/firstName/lastName/phone,
 * `profile.bio` and `profile.avatarUrl`).
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserDisplayName, useUserInitials } from '@/hooks/use-auth';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useUpdateUserProfile, useUserProfile } from '@/hooks/use-user-profile';
import { LoaderIcon, MailIcon, ShieldIcon, UserIcon } from '@repo/icons';
import { getMediaUrl } from '@repo/media';
import { type ProfileEditInput, ProfileEditSchema, type UserProtected } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/mi-cuenta/perfil')({
    component: MyProfilePage
});

/**
 * Build initial form values from the loaded profile, falling back to
 * empty strings so the form is fully controlled.
 */
function buildInitialValues(profile: UserProtected | undefined): ProfileEditInput {
    return {
        displayName: profile?.displayName ?? '',
        firstName: profile?.firstName ?? '',
        lastName: profile?.lastName ?? '',
        bio: profile?.profile?.bio ?? '',
        avatarUrl: profile?.profile?.avatar ?? '',
        phone: profile?.phone ?? ''
    };
}

function MyProfilePage() {
    const { t } = useTranslations();
    const { user: authUser } = useAuthContext();
    const displayName = useUserDisplayName();
    const initials = useUserInitials();
    const { success: toastSuccess, error: toastError } = useFlashyToast();

    const userId = authUser?.id;
    const { data: profile, isLoading, error, refetch } = useUserProfile({ userId });

    const updateMutation = useUpdateUserProfile({ userId });

    const form = useForm({
        defaultValues: buildInitialValues(profile),
        onSubmit: async ({ value }) => {
            const parsed = ProfileEditSchema.safeParse(value);
            if (!parsed.success) {
                toastError(t('admin-pages.profile.saveError'));
                return;
            }
            try {
                await updateMutation.mutateAsync(parsed.data);
                toastSuccess(t('admin-pages.profile.saveSuccess'));
            } catch {
                toastError(t('admin-pages.profile.saveError'));
            }
        }
    });

    if (isLoading) {
        return (
            <MainPageLayout title={t('ui.pages.myProfile')}>
                <div className="mx-auto max-w-4xl space-y-6">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={`skeleton-${String(i)}`}
                            className="h-48 animate-pulse rounded-lg bg-muted"
                        />
                    ))}
                </div>
            </MainPageLayout>
        );
    }

    if (error) {
        return (
            <MainPageLayout title={t('ui.pages.myProfile')}>
                <div className="mx-auto max-w-4xl">
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="mb-2 font-medium text-destructive">
                                {t('admin-pages.profile.loadError')}
                            </p>
                            <p className="mb-4 text-muted-foreground text-sm">{error.message}</p>
                            <Button
                                variant="outline"
                                onClick={() => refetch()}
                            >
                                {t('admin-pages.profile.retry')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </MainPageLayout>
        );
    }

    const avatarUrl = authUser?.avatar ?? profile?.profile?.avatar;
    const email = authUser?.email ?? profile?.email;
    const emailVerified = authUser?.emailVerified ?? false;
    const role = authUser?.role ?? profile?.role;

    const isSaving = updateMutation.isPending;

    return (
        <MainPageLayout title={t('ui.pages.myProfile')}>
            <div className="mx-auto max-w-4xl space-y-6">
                {/* Header card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                            <Avatar className="h-20 w-20 flex-shrink-0">
                                {avatarUrl ? (
                                    <AvatarImage
                                        src={getMediaUrl(avatarUrl, { preset: 'avatar' })}
                                        alt={displayName}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                ) : null}
                                <AvatarFallback className="bg-primary font-bold text-3xl text-primary-foreground">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>

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
                                            className="gap-1 border-success/40 text-success"
                                        >
                                            {t('admin-pages.profile.emailVerified')}
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="outline"
                                            className="gap-1 border-warning/40 text-warning"
                                        >
                                            {t('admin-pages.profile.emailNotVerified')}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Profile edit form */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="space-y-6"
                >
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                                    <UserIcon className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        {t('admin-pages.profile.personalInfo.title')}
                                    </CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-pages.profile.personalInfo.subtitle')}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <form.Field
                                    name="displayName"
                                    validators={{
                                        onBlur: ({ value }) => {
                                            const r =
                                                ProfileEditSchema.shape.displayName.safeParse(
                                                    value
                                                );
                                            return r.success
                                                ? undefined
                                                : r.error.issues[0]?.message;
                                        }
                                    }}
                                >
                                    {(field) => (
                                        <div>
                                            <Label htmlFor="displayName">
                                                {t('admin-pages.profile.personalInfo.displayName')}{' '}
                                                <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="displayName"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                onBlur={field.handleBlur}
                                                disabled={isSaving}
                                            />
                                            {field.state.meta.errors?.[0] && (
                                                <p className="mt-1 text-destructive text-xs">
                                                    {String(field.state.meta.errors[0])}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="firstName"
                                    validators={{
                                        onBlur: ({ value }) => {
                                            const r =
                                                ProfileEditSchema.shape.firstName.safeParse(value);
                                            return r.success
                                                ? undefined
                                                : r.error.issues[0]?.message;
                                        }
                                    }}
                                >
                                    {(field) => (
                                        <div>
                                            <Label htmlFor="firstName">
                                                {t('admin-pages.profile.personalInfo.firstName')}{' '}
                                                <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="firstName"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                onBlur={field.handleBlur}
                                                disabled={isSaving}
                                            />
                                            {field.state.meta.errors?.[0] && (
                                                <p className="mt-1 text-destructive text-xs">
                                                    {String(field.state.meta.errors[0])}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="lastName"
                                    validators={{
                                        onBlur: ({ value }) => {
                                            const r =
                                                ProfileEditSchema.shape.lastName.safeParse(value);
                                            return r.success
                                                ? undefined
                                                : r.error.issues[0]?.message;
                                        }
                                    }}
                                >
                                    {(field) => (
                                        <div>
                                            <Label htmlFor="lastName">
                                                {t('admin-pages.profile.personalInfo.lastName')}{' '}
                                                <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="lastName"
                                                value={field.state.value}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                onBlur={field.handleBlur}
                                                disabled={isSaving}
                                            />
                                            {field.state.meta.errors?.[0] && (
                                                <p className="mt-1 text-destructive text-xs">
                                                    {String(field.state.meta.errors[0])}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="phone"
                                    validators={{
                                        onBlur: ({ value }) => {
                                            const r =
                                                ProfileEditSchema.shape.phone.safeParse(value);
                                            return r.success
                                                ? undefined
                                                : r.error.issues[0]?.message;
                                        }
                                    }}
                                >
                                    {(field) => (
                                        <div>
                                            <Label htmlFor="phone">
                                                {t('admin-pages.profile.contactInfo.phone')}
                                            </Label>
                                            <Input
                                                id="phone"
                                                type="tel"
                                                placeholder="+541134567890"
                                                value={field.state.value ?? ''}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                onBlur={field.handleBlur}
                                                disabled={isSaving}
                                            />
                                            {field.state.meta.errors?.[0] && (
                                                <p className="mt-1 text-destructive text-xs">
                                                    {String(field.state.meta.errors[0])}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </form.Field>
                            </div>

                            <form.Field
                                name="avatarUrl"
                                validators={{
                                    onBlur: ({ value }) => {
                                        const r =
                                            ProfileEditSchema.shape.avatarUrl.safeParse(value);
                                        return r.success ? undefined : r.error.issues[0]?.message;
                                    }
                                }}
                            >
                                {(field) => (
                                    <div className="mt-4">
                                        <Label htmlFor="avatarUrl">
                                            {t('admin-pages.profile.personalInfo.avatarUrl')}
                                        </Label>
                                        <Input
                                            id="avatarUrl"
                                            type="url"
                                            placeholder="https://..."
                                            value={field.state.value ?? ''}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            disabled={isSaving}
                                        />
                                        {field.state.meta.errors?.[0] && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {String(field.state.meta.errors[0])}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field
                                name="bio"
                                validators={{
                                    onBlur: ({ value }) => {
                                        const r = ProfileEditSchema.shape.bio.safeParse(value);
                                        return r.success ? undefined : r.error.issues[0]?.message;
                                    }
                                }}
                            >
                                {(field) => (
                                    <div className="mt-4">
                                        <Label htmlFor="bio">
                                            {t('admin-pages.profile.personalInfo.bio')}
                                        </Label>
                                        <Textarea
                                            id="bio"
                                            rows={4}
                                            value={field.state.value ?? ''}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            disabled={isSaving}
                                        />
                                        {field.state.meta.errors?.[0] && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {String(field.state.meta.errors[0])}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>
                        </CardContent>
                    </Card>

                    {/* Read-only contact / security */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-400/10">
                                    <MailIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        {t('admin-pages.profile.contactInfo.title')}
                                    </CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-pages.profile.contactInfo.subtitle')}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                        {t('admin-pages.profile.contactInfo.email')}
                                    </span>
                                    <p className="text-sm">{email ?? '—'}</p>
                                </div>
                                <div>
                                    <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase">
                                        {t('admin-pages.profile.security.role')}
                                    </span>
                                    <p className="text-sm">{role ?? '—'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit row */}
                    <div className="flex justify-end gap-3">
                        <Button
                            type="submit"
                            disabled={isSaving}
                        >
                            {isSaving && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                            {isSaving
                                ? t('admin-pages.profile.saving')
                                : t('admin-pages.profile.save')}
                        </Button>
                    </div>
                </form>
            </div>
        </MainPageLayout>
    );
}
