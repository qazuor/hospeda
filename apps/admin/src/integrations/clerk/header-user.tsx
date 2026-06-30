/**
 * Header user menu component.
 *
 * Displays the current user's avatar with a dropdown menu for
 * profile access and sign-out. Uses AuthContext for user state.
 *
 * SPEC-174 T-014 additions (§7.8, D8):
 * - "Ver guía" — relaunches the role's welcome tour (ignores version/seen state,
 *   source: 'manual').
 * - "Ver guía de esta página" — relaunches the contextual tour for the current
 *   route when one exists (source: 'manual-page'). Hidden on routes without a
 *   contextual tour.
 *
 * @note This file is kept at the original path to minimize import
 * changes across existing components. Will be moved to a proper
 * location in the cleanup phase.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { TourRole } from '@/config/ia/tour.schema';
import { useTour } from '@/contexts/tour-context';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useContextualTourForRoute, useWelcomeTourForRole } from '@/hooks/use-tours';
import { useTranslations } from '@/hooks/use-translations';
import { signOut } from '@/lib/auth-client';
import { getInitialsFromName } from '@/lib/avatar-utils';
import { ChatIcon, CompassIcon, MapIcon } from '@repo/icons';
import { getMediaUrl } from '@repo/media';
import { useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

/**
 * HeaderUser renders a user avatar button with a dropdown menu
 */
export function HeaderUser() {
    const { user, isLoading } = useAuthContext();
    const router = useRouter();
    const { pathname } = useLocation();
    const { t } = useTranslations();
    const { startTour } = useTour();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Tour selectors (SPEC-174 T-014, §7.8)
    const role = (user?.role as TourRole | null | undefined) ?? null;
    const welcomeTour = useWelcomeTourForRole({ role });
    const contextualTour = useContextualTourForRoute({ pathname });

    // Close menu on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        window.addEventListener('pointerdown', handleClick, true);
        return () => window.removeEventListener('pointerdown', handleClick, true);
    }, [isOpen]);

    // Close menu on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    if (isLoading) {
        // Static placeholder (no animation) to reserve space without visual distraction.
        // With server hydration, isLoading is typically false from the first render.
        return <div className="h-8 w-8 rounded-full bg-muted/50" />;
    }

    if (!user) {
        return null;
    }

    const { initials } = getInitialsFromName({
        name: user.displayName,
        email: user.email
    });

    const handleSignOut = async () => {
        setIsOpen(false);
        await signOut();
        if (typeof window !== 'undefined') {
            // SPEC-182: land on the admin root after sign-out; the _authed
            // guard redirects the unauthenticated user to the unified web signin.
            window.location.href = '/';
        }
    };

    return (
        <div
            ref={menuRef}
            className="relative"
        >
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label="User menu"
                data-tour="user-menu"
            >
                <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                    {user.avatar ? (
                        <AvatarImage
                            src={getMediaUrl(user.avatar, { preset: 'avatar' })}
                            alt={user.displayName || 'User'}
                            loading="eager"
                            decoding="async"
                        />
                    ) : null}
                    <AvatarFallback className="bg-primary font-medium text-primary-foreground text-sm">
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover shadow-lg">
                    <div className="border-b px-4 py-3">
                        <p className="font-medium text-sm">{user.displayName || 'User'}</p>
                        <p className="truncate text-muted-foreground text-xs">{user.email}</p>
                    </div>
                    <div className="py-1">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                router.navigate({ to: '/account/profile' });
                            }}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                        >
                            Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                router.navigate({ to: '/account/preferences' });
                            }}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                        >
                            Settings
                        </button>

                        {/* Tour entry points (SPEC-174 T-014, §7.8, D8) */}
                        {welcomeTour && (
                            <>
                                <hr className="my-1" />
                                {/* "Ver guía" — replay role welcome tour, ignores seen/version */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        startTour({ tourId: welcomeTour.id, source: 'manual' });
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent"
                                    aria-label={t('admin-common.tour.replay')}
                                >
                                    <CompassIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    {t('admin-common.tour.replay')}
                                </button>

                                {/* "Ver guía de esta página" — only when a contextual tour
                                    exists for the current route */}
                                {contextualTour && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsOpen(false);
                                            startTour({
                                                tourId: contextualTour.id,
                                                source: 'manual-page'
                                            });
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent"
                                        aria-label={t('admin-common.tour.replayPage')}
                                    >
                                        <MapIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        {t('admin-common.tour.replayPage')}
                                    </button>
                                )}
                            </>
                        )}

                        {/*
                         * SPEC-301 T-010 — "Reportar un problema" visible entry
                         * point for the in-page feedback modal. Dispatches
                         * `feedback:open` so AdminFeedbackHeadlessHost (mounted in
                         * __root.tsx) intercepts and opens the modal, without any
                         * page navigation.
                         */}
                        <hr className="my-1" />
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('feedback:open'));
                                }
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent"
                            aria-label={t('admin-nav.topbar.reportProblem')}
                        >
                            <ChatIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {t('admin-nav.topbar.reportProblem')}
                        </button>

                        <hr className="my-1" />
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="block w-full px-4 py-2 text-left text-destructive text-sm hover:bg-accent"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
