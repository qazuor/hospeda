/**
 * @file ListingSectionTabs.client.tsx
 * @description Sticky in-page section tabs of the listing detail pages (HOS-2527).
 * Plain anchors that work before hydration; the island adds the active-tab tracking
 * and, on desktop, the price plus contact CTA (analytics origin `tabs`) once the
 * gallery scrolls out of view.
 */
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    getListingContactPrice,
    listingContactPriceSchema
} from '@/lib/listing-contact/listing-contact-price';
import { scrollToListingSection } from '@/lib/listing-detail/section-scroll';
import { getListingSectionTabLabelKey, listingSectionKeySchema } from '@/lib/listing-section-tabs';
import { syncTabScrollFade } from '@/lib/ui/tab-scroll-fade';
import { ListingContactActions } from './contact/ListingContactActions';
import styles from './ListingSectionTabs.module.css';

const propsSchema = z
    .object({
        tabs: z
            .array(
                z
                    .object({
                        key: listingSectionKeySchema,
                        id: z.string().min(1),
                        hideOnDesktop: z.boolean()
                    })
                    .readonly()
            )
            .readonly(),
        locale: z.enum(['es', 'en', 'pt']),
        vertical: z.enum(['accommodation', 'experience', 'venue']),
        listingId: z.string().min(1),
        reviewCount: z.number().int().nonnegative().optional(),
        price: listingContactPriceSchema,
        panelId: z.string().min(1),
        primaryLabelKey: z.string().min(1),
        /** Id of the gallery element: once it scrolls out, the desktop band shows price and CTA. */
        galleryId: z.string().min(1).optional(),
        /** In-page anchor the CTA falls back to before the panel is ready (venue, experience). */
        fallbackHref: z.string().min(1).optional(),
        /** Turns the CTA into a plain outbound link (the venue menu, HOS-2520 §7.8). */
        primaryLink: z
            .object({ href: z.string().min(1), channel: z.literal('menu') })
            .readonly()
            .optional(),
        /**
         * `false` when the listing has no channel to consult (a venue or experience
         * with no public contact): the band then shows the price only, never a
         * button that opens nothing. Defaults to `true`.
         */
        hasContactAction: z.boolean().optional()
    })
    .readonly();

/** Session-blind props of the sticky section navigation. */
export type ListingSectionTabsProps = z.infer<typeof propsSchema>;

/** Accessible name of the navigation per vertical: a bar is not «Secciones del alojamiento». */
const NAV_LABEL_KEYS = {
    accommodation: 'accommodations.detail.sectionTabs.label',
    venue: 'accommodations.detail.sectionTabs.labelVenue',
    experience: 'accommodations.detail.sectionTabs.labelExperience'
} as const;

/** Extra breathing room kept between the sticky band and a section it scrolled to. */
const SCROLL_GAP_PX = 8;
const FALLBACK_NAVBAR_PX = 80;
const FALLBACK_WAVE_BAR_PX = 72;

/** Reads a pixel-valued CSS custom property from the root, with a fallback. */
function readPxVar({
    name,
    fallback
}: {
    readonly name: string;
    readonly fallback: number;
}): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Height of everything that is pinned above the sections: navbar + wave band + this bar.
 * The stuck position of the bar is read from its computed `top`, which already follows
 * the wave band sliding in and out; the CSS variables are only the fallback (no layout).
 */
function readStickyOffset({ nav }: { readonly nav: HTMLElement | null }): number {
    const stuckTop = nav ? Number.parseFloat(getComputedStyle(nav).top) : Number.NaN;
    const above = Number.isFinite(stuckTop)
        ? stuckTop
        : readPxVar({ name: '--navbar-height', fallback: FALLBACK_NAVBAR_PX }) +
          readPxVar({ name: '--wave-bar-compact', fallback: FALLBACK_WAVE_BAR_PX });
    return above + (nav?.offsetHeight ?? 0);
}

/** True when the element is actually laid out (not `display: none` in this layout). */
function isRendered(element: Element): boolean {
    return element.getClientRects().length > 0;
}

/**
 * Sticky section tabs for a listing detail page. They are plain in-page anchors, so
 * they work before hydration and without JavaScript; the island adds the active-tab
 * tracking, the horizontal auto-scroll and, on desktop, the price and contact button
 * once the gallery has scrolled out of view.
 */
export function ListingSectionTabs(props: ListingSectionTabsProps) {
    const parsed = propsSchema.safeParse(props);
    const navRef = useRef<HTMLElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [activeId, setActiveId] = useState<string | null>(
        parsed.success ? (parsed.data.tabs[0]?.id ?? null) : null
    );
    const [galleryOut, setGalleryOut] = useState(false);
    // The running tab-jump animation, so a second tap replaces the first.
    const scrollRef = useRef<{ readonly cancel: () => void } | null>(null);
    const tabs = parsed.success ? parsed.data.tabs : [];
    const galleryId = parsed.success ? parsed.data.galleryId : undefined;
    const tabIds = tabs.map((tab) => tab.id).join('|');
    // Sticky offset, re-measured when the wave band slides out/in or the viewport changes.
    const [stickyOffset, setStickyOffset] = useState<number | null>(null);

    // A tab jump never outlives the island (view transitions unmount it).
    useEffect(() => () => scrollRef.current?.cancel(), []);

    useEffect(() => {
        const bar = listRef.current;
        if (!bar || !tabIds) return;
        const update = () => syncTabScrollFade({ bar });
        update();
        bar.addEventListener('scroll', update, { passive: true });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
        observer?.observe(bar);
        for (const child of bar.children) observer?.observe(child);
        return () => {
            observer?.disconnect();
            bar.removeEventListener('scroll', update);
        };
    }, [tabIds]);

    useEffect(() => {
        const nav = navRef.current;
        // The wave band is not a fixed 72px: on a detail page it holds the name and badges
        // (~167px at 360px). Publish its real height so the bar sticks right under it in
        // every state; a fixed offset left the band covering the tabs on scroll-up.
        const bars = [
            ...document.querySelectorAll<HTMLElement>('[data-wave-header] .wave-header__bar')
        ];
        const publishBarHeight = (): void => {
            const bar = bars[0];
            if (!nav || !bar) return;
            nav.style.setProperty('--tabs-bar-height', `${bar.offsetHeight}px`);
        };
        const measure = (): void => {
            publishBarHeight();
            const next = readStickyOffset({ nav });
            setStickyOffset((previous) => (previous === next ? previous : next));
        };
        measure();
        window.addEventListener('resize', measure);
        // The band toggles `wave-header--hidden`; the bar then animates its `top`,
        // so measure again once that transition ends.
        nav?.addEventListener('transitionend', measure);
        const classObserver =
            typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure);
        for (const header of document.querySelectorAll('[data-wave-header]')) {
            classObserver?.observe(header, { attributes: true, attributeFilter: ['class'] });
        }
        const barObserver =
            typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        for (const bar of bars) barObserver?.observe(bar);
        return () => {
            window.removeEventListener('resize', measure);
            nav?.removeEventListener('transitionend', measure);
            classObserver?.disconnect();
            barObserver?.disconnect();
        };
    }, []);

    // Active tab follows the scroll.
    // biome-ignore lint/correctness/useExhaustiveDependencies: tabIds is the stable identity of the tab list.
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined' || stickyOffset === null) return;
        const targets = tabs
            .map((tab) => document.getElementById(tab.id))
            .filter((element): element is HTMLElement => element !== null && isRendered(element));
        if (targets.length === 0) return;
        const inBand = new Set<string>();
        const offset = stickyOffset + SCROLL_GAP_PX;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) inBand.add(entry.target.id);
                    else inBand.delete(entry.target.id);
                }
                const first = targets.find((target) => inBand.has(target.id));
                if (first) setActiveId(first.id);
            },
            // The band runs from just under the sticky bars to ~45% of the viewport.
            { rootMargin: `-${offset}px 0px -55% 0px` }
        );
        for (const target of targets) observer.observe(target);
        return () => observer.disconnect();
    }, [tabIds, stickyOffset]);

    // Desktop: show the price and contact button once the gallery is out of view.
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined' || !galleryId || stickyOffset === null) {
            return;
        }
        const gallery = document.getElementById(galleryId);
        if (!gallery) return;
        const offset = stickyOffset;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry) return;
                setGalleryOut(!entry.isIntersecting && entry.boundingClientRect.top < 0);
            },
            { rootMargin: `-${offset}px 0px 0px 0px` }
        );
        observer.observe(gallery);
        return () => observer.disconnect();
    }, [galleryId, stickyOffset]);

    // Keep the active tab visible inside the horizontally scrolling list.
    useEffect(() => {
        const list = listRef.current;
        if (!list || !activeId) return;
        const link = list.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
        if (!link || list.scrollWidth <= list.clientWidth) return;
        const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
        list.scrollTo({ left, behavior: 'auto' });
    }, [activeId]);

    if (!parsed.success || tabs.length === 0) return null;
    const {
        locale,
        vertical,
        listingId,
        price,
        panelId,
        primaryLabelKey,
        fallbackHref,
        primaryLink,
        hasContactAction = true
    } = parsed.data;
    const { t } = createTranslations(locale as SupportedLocale);
    const display = getListingContactPrice({ price, locale });

    function handleClick({
        event,
        id
    }: {
        readonly event: MouseEvent<HTMLAnchorElement>;
        readonly id: string;
    }): void {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Not scrollIntoView: the wave band collapses and slides out during the
        // scroll, so a destination computed up front lands under the tabs (HOS-2605).
        // The driver re-measures the sticky offset on every frame.
        scrollRef.current?.cancel();
        scrollRef.current = scrollToListingSection({
            target,
            readOffset: () => readStickyOffset({ nav: navRef.current }),
            gap: SCROLL_GAP_PX,
            reduceMotion,
            win: window
        });
        history.replaceState(null, '', `#${id}`);
        setActiveId(id);
    }

    return (
        <nav
            ref={navRef}
            className={styles.nav}
            aria-label={t(NAV_LABEL_KEYS[vertical])}
            data-listing-section-tabs
        >
            <ul
                ref={listRef}
                className={styles.list}
            >
                {tabs.map((tab) => (
                    <li
                        key={tab.key}
                        className={tab.hideOnDesktop ? styles.narrowOnly : undefined}
                    >
                        <a
                            href={`#${tab.id}`}
                            className={styles.link}
                            data-tab-id={tab.id}
                            aria-current={activeId === tab.id ? 'location' : undefined}
                            onClick={(event) => handleClick({ event, id: tab.id })}
                        >
                            {t(
                                `accommodations.detail.sectionTabs.${getListingSectionTabLabelKey({ key: tab.key, vertical })}`
                            )}
                            {tab.key === 'reviews' && parsed.data.reviewCount
                                ? ` (${parsed.data.reviewCount})`
                                : null}
                        </a>
                    </li>
                ))}
            </ul>
            <div
                className={styles.cta}
                hidden={!galleryOut}
                data-listing-section-cta
            >
                {display && (
                    <p className={styles.price}>
                        <strong>{display.amount}</strong>{' '}
                        {display.unit && <span>{display.unit}</span>}
                    </p>
                )}
                {hasContactAction && (
                    <ListingContactActions
                        listingId={listingId}
                        vertical={vertical}
                        locale={locale}
                        hasWhatsapp={false}
                        panelId={panelId}
                        primaryLabelKey={primaryLabelKey}
                        origin="tabs"
                        fallbackHref={fallbackHref}
                        primaryLink={primaryLink}
                    />
                )}
            </div>
        </nav>
    );
}
