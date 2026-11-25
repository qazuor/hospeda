/** Shared navigation-dialog history ownership, including cross-island handoff. */

import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { acquireDialogHistoryEntry } from '@/lib/dialog-history';

/** Shared handlers for a navigation surface that owns its history entry. */
export interface NavigationDialogHandlers {
    readonly closeThen: (params: { readonly afterClose: () => void }) => void;
    readonly onLinkClick: (event: MouseEvent<HTMLElement>) => void;
}

/** Navigates once, after the dialog entry has been unwound. */
async function continueNavigation({ href }: { readonly href: string }): Promise<void> {
    try {
        const { navigate } = await import('astro:transitions/client');
        await navigate(href);
    } catch {
        window.location.assign(href);
    }
}

/** Owns the entry instead of Drawer; waits for popstate OR a bounded fallback. */
export function useNavigationDialog({
    open,
    onClose
}: {
    readonly open: boolean;
    readonly onClose: () => void;
}): NavigationDialogHandlers {
    const releaseRef = useRef<(() => void) | null>(null);
    const pendingRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!open) return;
        const { release } = acquireDialogHistoryEntry({ onPopped: onClose });
        releaseRef.current = release;
        return () => {
            if (releaseRef.current === release) {
                releaseRef.current = null;
                release();
            }
        };
    }, [open, onClose]);

    useEffect(() => {
        const beforeSwap = () => {
            pendingRef.current?.();
            onClose();
        };
        document.addEventListener('astro:before-swap', beforeSwap);
        return () => {
            document.removeEventListener('astro:before-swap', beforeSwap);
            pendingRef.current?.();
        };
    }, [onClose]);

    const closeThen = useCallback(
        ({ afterClose }: { readonly afterClose: () => void }) => {
            if (pendingRef.current) return;
            const release = releaseRef.current;
            releaseRef.current = null;
            let settled = false;
            let timer = 0;
            const cancel = () => {
                settled = true;
                window.clearTimeout(timer);
                window.removeEventListener('popstate', finish);
                pendingRef.current = null;
            };
            const finish = () => {
                if (settled) return;
                cancel();
                // Let every popstate listener and React's close cleanup finish first.
                timer = window.setTimeout(() => {
                    pendingRef.current = null;
                    afterClose();
                }, 0);
                pendingRef.current = () => window.clearTimeout(timer);
            };
            pendingRef.current = cancel;
            window.addEventListener('popstate', finish, { once: true });
            timer = window.setTimeout(finish, release ? 160 : 0);
            onClose();
            release?.();
        },
        [onClose]
    );

    const onLinkClick = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            const anchor = event.target instanceof Element ? event.target.closest('a') : null;
            if (!anchor || !open || event.defaultPrevented) return;
            if (
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey ||
                anchor.hasAttribute('download') ||
                (anchor.target !== '' && anchor.target !== '_self') ||
                !anchor.getAttribute('href') ||
                anchor.origin !== window.location.origin
            ) {
                // Preserve the browser's navigation semantics while dismissing the surface.
                onClose();
                return;
            }
            event.preventDefault();
            closeThen({ afterClose: () => void continueNavigation({ href: anchor.href }) });
        },
        [open, closeThen, onClose]
    );

    return { closeThen, onLinkClick };
}
