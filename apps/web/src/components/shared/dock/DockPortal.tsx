import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MobileDockSlot } from '@/lib/mobile-dock/mobile-dock-slots';

/** Props for a control that may render into a named mobile dock slot. */
export interface DockPortalProps {
    readonly slot: MobileDockSlot;
    readonly children: ReactNode;
}

/**
 * Renders children in place on SSR and the first client render so hydration
 * sees the same tree. After mount it portals into the named dock slot when one
 * exists; without a slot it keeps the children in place as a safe fallback.
 *
 * Wrap only the button or bar, never its overlay, panel, drawer, or sheet: the
 * dock row uses backdrop-filter, which creates a containing block for fixed
 * descendants. Keep DockPortal mounted and toggle its children instead. If the
 * portal itself mounts with each button appearance, that button first appears
 * in place and moves on the next render, so focus returned to it can land on a
 * node that no longer exists.
 */
export function DockPortal({ slot, children }: DockPortalProps) {
    const [target, setTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTarget(document.querySelector<HTMLElement>(`[data-mobile-dock-slot="${slot}"]`));
    }, [slot]);

    return target ? createPortal(children, target) : children;
}
