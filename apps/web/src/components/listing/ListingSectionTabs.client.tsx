import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    getListingContactPrice,
    listingContactPriceSchema
} from '@/lib/listing-contact/listing-contact-price';
import { listingSectionKeySchema } from '@/lib/listing-section-tabs';
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
        price: listingContactPriceSchema,
        panelId: z.string().min(1),
        primaryLabelKey: z.string().min(1),
        /** Id of the gallery element: once it scrolls out, the desktop band shows price and CTA. */
        galleryId: z.string().min(1).optional()
    })
    .readonly();

/** Session-blind props of the sticky section navigation. */
export type ListingSectionTabsProps = z.infer<typeof propsSchema>;

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

/** Height of everything that is pinned above the sections: navbar + wave band + this bar. */
function readStickyOffset({ nav }: { readonly nav: HTMLElement | null }): number {
    return (
        readPxVar({ name: '--navbar-height', fallback: FALLBACK_NAVBAR_PX }) +
        readPxVar({ name: '--wave-bar-compact', fallback: FALLBACK_WAVE_BAR_PX }) +
        (nav?.offsetHeight ?? 0)
    );
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
    const tabs = parsed.success ? parsed.data.tabs : [];
    const galleryId = parsed.success ? parsed.data.galleryId : undefined;
    const tabIds = tabs.map((tab) => tab.id).join('|');

    // Active tab follows the scroll.
    // biome-ignore lint/correctness/useExhaustiveDependencies: tabIds is the stable identity of the tab list.
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const targets = tabs
            .map((tab) => document.getElementById(tab.id))
            .filter((element): element is HTMLElement => element !== null && isRendered(element));
        if (targets.length === 0) return;
        const inBand = new Set<string>();
        const offset = readStickyOffset({ nav: navRef.current }) + SCROLL_GAP_PX;
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
    }, [tabIds]);

    // Desktop: show the price and contact button once the gallery is out of view.
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined' || !galleryId) return;
        const gallery = document.getElementById(galleryId);
        if (!gallery) return;
        const offset = readStickyOffset({ nav: navRef.current });
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry) return;
                setGalleryOut(!entry.isIntersecting && entry.boundingClientRect.top < 0);
            },
            { rootMargin: `-${offset}px 0px 0px 0px` }
        );
        observer.observe(gallery);
        return () => observer.disconnect();
    }, [galleryId]);

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
    const { locale, vertical, listingId, price, panelId, primaryLabelKey } = parsed.data;
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
        // scroll-margin-top on the section (plus the page scroll-padding) keeps it below the sticky band.
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', `#${id}`);
        setActiveId(id);
    }

    return (
        <nav
            ref={navRef}
            className={styles.nav}
            aria-label={t('accommodations.detail.sectionTabs.label')}
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
                            {t(`accommodations.detail.sectionTabs.${tab.key}`)}
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
                <ListingContactActions
                    listingId={listingId}
                    vertical={vertical}
                    locale={locale}
                    hasWhatsapp={false}
                    panelId={panelId}
                    primaryLabelKey={primaryLabelKey}
                    origin="bar"
                />
            </div>
        </nav>
    );
}
