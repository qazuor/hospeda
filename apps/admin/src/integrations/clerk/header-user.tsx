/**
 * Header user menu component.
 *
 * Displays the current user's avatar with a dropdown menu for
 * profile access and sign-out. Uses AuthContext for user state.
 *
 * @note This file is kept at the original path to minimize import
 * changes across existing components. Will be moved to a proper
 * location in the cleanup phase.
 */

import { useAuthContext } from '@/hooks/use-auth-context';
import { signOut } from '@/lib/auth-client';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

/**
 * HeaderUser renders a user avatar button with a dropdown menu
 */
export function HeaderUser() {
    const { user, isLoading } = useAuthContext();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    const initials = (user.displayName || user.email || '?')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handleSignOut = async () => {
        setIsOpen(false);
        await signOut();
        if (typeof window !== 'undefined') {
            window.location.href = '/auth/signin';
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label="User menu"
            >
                {user.avatar ? (
                    <img
                        src={user.avatar}
                        alt={user.displayName || 'User'}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    initials
                )}
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
                                router.navigate({ to: '/me/profile' });
                            }}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                        >
                            Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                router.navigate({ to: '/me/settings' });
                            }}
                            className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                        >
                            Settings
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
