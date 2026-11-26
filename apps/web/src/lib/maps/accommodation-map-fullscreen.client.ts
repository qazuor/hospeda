/*
 * Mobile fullscreen-map setup. On narrow viewports the map page collapses
 * to: navbar + compact wave header + map filling the rest of the viewport.
 * Steps on every astro:page-load (so View Transitions still trigger it):
 *   1. Add `data-locked-compact` + the compact class directly. The wave state
 *      machine honors data-locked-compact (pins compact, suppresses hidden),
 *      and on listing the --hidden translate is suppressed anyway, so the bar
 *      can't expand back out or slide away near the top.
 *   2. Wait one frame for the compact class + CSS transition to apply,
 *      then measure the bar and publish its height as
 *      `--wave-bar-compact`. The map's CSS uses that var to size itself
 *      so the bottom edge lands exactly at the viewport bottom.
 *   3. Smooth-scroll so the map top lands flush below the compact bar
 *      (only if the user landed at the top — respect restored scroll on
 *      back navigation).
 */
export function setupMobileFullscreenMap() {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    const waveHeader = document.querySelector<HTMLElement>('.wave-header');
    const mapEl = document.getElementById('acc-listing-map');
    if (!waveHeader || !mapEl) return;

    // Opt out of the browser's automatic scroll restoration on this page:
    // we always want the map fullscreen landing, even on reload. Otherwise
    // the restored scroll position fires between DOMContentLoaded and our
    // setTimeout below, leaving the map a strip below the fold.
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // Lock the wave header in compact mode. The wave state machine honors
    // data-locked-compact (pins compact, never hides), and on listing the
    // --hidden translate is suppressed regardless, so nothing expands or
    // slides the bar out. The manual compact class covers the pre-init frame.
    waveHeader.dataset.lockedCompact = 'true';
    waveHeader.classList.add('wave-header--compact');

    const navbarHeight =
        parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')
        ) || 80;

    // Wait for the CSS transition (~300ms) before measuring.
    window.setTimeout(() => {
        const bar = waveHeader.querySelector<HTMLElement>('.wave-header__bar');
        const barHeight = bar?.offsetHeight ?? 88;
        document.documentElement.style.setProperty('--wave-bar-compact', `${barHeight}px`);

        const target =
            mapEl.getBoundingClientRect().top + window.scrollY - navbarHeight - barHeight;
        window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, 340);
}
