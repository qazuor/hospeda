/**
 * @file menu-qr-tour-anchor.ts
 * @description Decides whether the venue welcome tour gets its `venue-qr`
 * anchor (HOS-1856, AC:5:3).
 *
 * The widget is decided per venue on the client, but the tour runs as soon as
 * the page is interactive — before `client:visible` has hydrated the widget
 * (and, for a menu-less venue, the widget renders `null`). So the anchor has to
 * be resolved on the server, from the same section-state map the widget itself
 * reads.
 *
 * Decision (owner, 2026-11-04): the step follows the widget. It is offered
 * whenever at least one venue's `menu` section is anything but `absent`, which
 * includes `locked` — the widget still renders its upsell there. A failed
 * section read is not "absent": it is unknown, so the anchor is withheld rather
 * than pointing at an element whose existence cannot be proven.
 */

import type { ListingSectionState } from '@repo/schemas';

/**
 * The slice of `GET /venues/:id/sections` this decision reads.
 *
 * `sections` is a record rather than `{ menu: … }` because the generated
 * response type loses its keys through `Object.fromEntries`; the key is read
 * defensively.
 */
export interface MenuQrTourSectionStates {
    readonly sections: Readonly<
        Record<string, { readonly state: ListingSectionState } | undefined>
    >;
}

/**
 * Places the `data-tour="venue-qr"` anchor only when the menu QR widget will
 * render something for at least one venue.
 *
 * @param params - `sectionStates`, one entry per venue listing in the page, or
 *   `null` when that venue's section read failed.
 * @returns `true` when every read succeeded and at least one venue's `menu`
 *   section is not `absent`; `false` otherwise (including an empty list).
 */
export function shouldAnchorMenuQrTour({
    sectionStates
}: {
    readonly sectionStates: readonly (MenuQrTourSectionStates | null)[];
}): boolean {
    let anyMenuPresent = false;

    for (const states of sectionStates) {
        if (states === null) {
            return false;
        }
        if (states.sections.menu?.state !== undefined && states.sections.menu.state !== 'absent') {
            anyMenuPresent = true;
        }
    }

    return anyMenuPresent;
}
