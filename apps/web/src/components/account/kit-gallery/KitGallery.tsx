/**
 * KitGallery — every Mi Cuenta kit component in every state, on one page
 * (HOS-2413 T-029). It exists for review and for the visual-regression suite
 * (each state sits in a `data-visual` block); it is never linked from the
 * product and the page answers 404 unless `HOSPEDA_ACCOUNT_KIT_GALLERY` is on.
 *
 * A static guard (`test/components/account/kit-gallery.test.ts`) fails when a
 * component is exported from `ui/index.ts` without an entry here.
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGallery
 */

import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './KitGallery.module.css';
import { KitGalleryActions } from './KitGalleryActions';
import { KitGalleryData } from './KitGalleryData';
import { KitGalleryEditor } from './KitGalleryEditor';
import { KitGalleryFeedback } from './KitGalleryFeedback';
import { KitGalleryForms } from './KitGalleryForms';
import { KitGalleryListings } from './KitGalleryListings';
import { KitGalleryLongTail } from './KitGalleryLongTail';

/** Props of {@link KitGallery}. */
export interface KitGalleryProps {
    /** Locale of the gallery. */
    readonly locale: SupportedLocale;
}

/**
 * The gallery. Hydrated with `client:load` (the overlays need a real DOM).
 *
 * @param props - See {@link KitGalleryProps}.
 * @returns The whole gallery.
 */
export function KitGallery({ locale }: KitGalleryProps) {
    const [openOverlay, setOpenOverlay] = useState<string | null>(null);

    useEffect(() => {
        setOpenOverlay(new URLSearchParams(window.location.search).get('open'));
    }, []);

    return (
        <div
            className={styles.gallery}
            data-kit-gallery=""
            key={openOverlay ?? 'closed'}
        >
            <KitGalleryActions locale={locale} />
            <KitGalleryForms locale={locale} />
            <KitGalleryData locale={locale} />
            <KitGalleryListings locale={locale} />
            <KitGalleryLongTail locale={locale} />
            <KitGalleryEditor locale={locale} />
            <KitGalleryFeedback
                locale={locale}
                openOverlay={openOverlay}
            />
        </div>
    );
}
