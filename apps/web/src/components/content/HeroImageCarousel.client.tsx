/**
 * Hero image carousel with smooth crossfade transitions, Ken Burns zoom,
 * dot indicators, and optional parallax.
 *
 * Auto-advances every `interval` ms, pauses on hover.
 * Active dot stretches into a pill shape. Inactive dots are small circles.
 * Respects prefers-reduced-motion (instant transitions, no auto-play, no Ken Burns).
 *
 * Dot indicators are rendered via createPortal to escape the hero's
 * stacking context so they always appear above all other layers.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

export interface HeroImageCarouselProps {
    /** Array of image URLs to cycle through */
    readonly images: readonly string[];
    /** Auto-advance interval in milliseconds (default: 6000) */
    readonly interval?: number;
    /** Accessible label for the carousel region */
    readonly ariaLabel?: string;
    /** Enable parallax scroll effect on desktop */
    readonly enableParallax?: boolean;
    /** Callback fired when the active slide changes */
    readonly onSlideChange?: (index: number) => void;
    /** Locale for i18n translations */
    readonly locale?: SupportedLocale;
}

export function HeroImageCarousel({
    images,
    interval = 6000,
    ariaLabel = 'Hero image carousel',
    enableParallax = false,
    onSlideChange,
    locale = 'es'
}: HeroImageCarouselProps) {
    const { t } = useTranslation({ locale, namespace: 'ui' });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [animationKey, setAnimationKey] = useState(0);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const containerRef = useRef<HTMLElement>(null);

    /* Detect reduced motion preference */
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    /* Create portal target inside the hero section (not inside carousel wrapper) */
    useEffect(() => {
        const heroSection = document.querySelector('.hero-section');
        if (!heroSection) return;

        const el = document.createElement('div');
        el.className = 'carousel-dots-portal';
        el.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:30;';
        heroSection.appendChild(el);
        setPortalTarget(el);

        return () => {
            heroSection.removeChild(el);
        };
    }, []);

    /* Parallax scroll effect (desktop only) */
    useEffect(() => {
        if (!enableParallax || prefersReducedMotion) return;
        const el = containerRef.current;
        if (!el) return;

        let ticking = false;
        function onScroll(): void {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (window.innerWidth >= 1024 && el) {
                        el.style.setProperty('--parallax-y', `${window.scrollY * 0.15}px`);
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [enableParallax, prefersReducedMotion]);

    const goToIndex = useCallback(
        (index: number) => {
            setCurrentIndex(index);
            setAnimationKey((prev) => prev + 1);
            onSlideChange?.(index);
        },
        [onSlideChange]
    );

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => {
            const next = (prev + 1) % images.length;
            setAnimationKey((k) => k + 1);
            onSlideChange?.(next);
            return next;
        });
    }, [images.length, onSlideChange]);

    /* Auto-advance timer */
    useEffect(() => {
        if (isPaused || prefersReducedMotion || images.length <= 1) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        timerRef.current = setInterval(goToNext, interval);
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isPaused, prefersReducedMotion, images.length, interval, goToNext]);

    if (images.length === 0) {
        return null;
    }

    const fadeDuration = prefersReducedMotion ? '0ms' : '2000ms';
    const showDots = images.length > 1;

    const dotsNav =
        showDots && portalTarget
            ? createPortal(
                  <nav
                      className="-translate-x-1/2 pointer-events-auto absolute left-1/2 flex items-center gap-3 rounded-full bg-black/70 px-4 py-2"
                      style={{ top: 'calc(100svh - 4rem)' }}
                      aria-label={t('accessibility.carouselNavigation')}
                  >
                      {images.map((src, index) => {
                          const isActive = index === currentIndex;
                          return (
                              <button
                                  key={`dot-${src}`}
                                  type="button"
                                  onClick={() => goToIndex(index)}
                                  className={`carousel-dot relative overflow-hidden rounded-full bg-nav-text transition-all duration-500 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-nav-text-active focus-visible:outline-offset-2 ${
                                      isActive ? 'h-4 w-12' : 'h-4 w-4'
                                  }`}
                                  aria-label={t('accessibility.goToImageOfTotal', undefined, {
                                      current: index + 1,
                                      total: images.length
                                  })}
                                  aria-current={isActive ? 'true' : undefined}
                              >
                                  {/* Progress fill inside active dot */}
                                  {isActive && !prefersReducedMotion && (
                                      <span
                                          className="absolute inset-0 origin-left rounded-full bg-nav-text-active/60"
                                          style={
                                              isPaused
                                                  ? { transform: 'scaleX(0.5)' }
                                                  : {
                                                        animation: `progressFill ${interval}ms linear forwards`
                                                    }
                                          }
                                      />
                                  )}
                              </button>
                          );
                      })}
                  </nav>,
                  portalTarget
              )
            : null;

    return (
        <section
            ref={containerRef}
            className="relative h-full w-full"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            aria-label={ariaLabel}
            aria-roledescription="carousel"
            style={{ transform: enableParallax ? 'translateY(var(--parallax-y, 0px))' : undefined }}
        >
            {/* Image layers with crossfade + Ken Burns */}
            {images.map((src, index) => {
                const isActive = index === currentIndex;
                return (
                    <img
                        key={`${src}-${isActive ? animationKey : index}`}
                        src={src}
                        alt=""
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        className={`absolute inset-0 h-full w-full object-cover ${
                            isActive && !prefersReducedMotion ? 'animate-ken-burns' : ''
                        }`}
                        style={{
                            opacity: isActive ? 1 : 0,
                            transition: `opacity ${fadeDuration} cubic-bezier(0.4, 0, 0.2, 1)`,
                            zIndex: isActive ? 10 : 0
                        }}
                        aria-hidden={!isActive}
                    />
                );
            })}

            {/* Dots rendered via portal to escape stacking context */}
            {dotsNav}
        </section>
    );
}
