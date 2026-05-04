/**
 * @file GuestPreferenceNudge.client.tsx
 * @description Listens for `preferences:change` and shows a registration
 * nudge toast to unauthenticated visitors.
 *
 * Behavior:
 *   - First time per session: always shows the `cross-device` message
 *     (most contextually relevant since the user just changed a preference).
 *   - Subsequent triggers: picks a random message from the pool, weighted
 *     by tags that match the current page context (accommodation listing
 *     prefers favorites/collections, blog post prefers notifications/reviews,
 *     etc.). Skips the last shown ID to avoid back-to-back repeats.
 *   - Throttle: 8s between toasts, regardless of how fast the user toggles.
 *   - Auth check: bails out if `<html data-user-authenticated="true">`.
 *   - Pool exhaustion: once all 8 messages have been shown in the session,
 *     resets and starts over.
 *
 * The component renders nothing. It only orchestrates `addToast` calls
 * via the global toast store. Mount it once per session in the layout.
 */

import { addToast } from '@/store/toast-store';
import { useEffect } from 'react';

const THROTTLE_MS = 8000;
const TOAST_DURATION_MS = 6000;
const SHOWN_IDS_KEY = 'guestNudgeShownIds';
const LAST_SHOWN_KEY = 'guestNudgeLastShown';
const LAST_ID_KEY = 'guestNudgeLastId';

const SIGNUP_PATH_PREFIX = '/auth/signup';
const BENEFITS_PATH_PREFIX = '/beneficios';

type NudgeId =
    | 'cross-device'
    | 'favorites'
    | 'collections'
    | 'messages'
    | 'reviews'
    | 'notifications'
    | 'host'
    | 'promotions';

interface NudgeMessage {
    readonly id: NudgeId;
    readonly message: string;
    /**
     * Tags used to bias contextual selection. Higher weight means the message
     * is more relevant to a page that shares the tag.
     */
    readonly tags: ReadonlyArray<string>;
}

const POOL: ReadonlyArray<NudgeMessage> = [
    {
        id: 'cross-device',
        message: '💾 Tus preferencias te seguirán en cualquier dispositivo cuando te registres.',
        tags: ['preferences', 'any']
    },
    {
        id: 'favorites',
        message: '❤️ Guardá los alojamientos que te gusten en favoritos y volvé cuando quieras.',
        tags: ['accommodation', 'destination', 'event', 'listing', 'detail']
    },
    {
        id: 'collections',
        message: '📂 Armá colecciones de viaje ("Verano 2026", "Aniversario") y compartilas.',
        tags: ['accommodation', 'listing', 'destination']
    },
    {
        id: 'messages',
        message: '💬 Escribiles a los anfitriones para resolver dudas antes de reservar.',
        tags: ['accommodation', 'detail', 'contact']
    },
    {
        id: 'reviews',
        message: '⭐ Dejá reseñas y ayudá a otros viajeros a elegir mejor.',
        tags: ['accommodation', 'destination', 'detail', 'post']
    },
    {
        id: 'notifications',
        message: '📧 Recibí novedades y promos de los lugares que te interesan.',
        tags: ['post', 'event', 'destination', 'any']
    },
    {
        id: 'host',
        message: '🏡 ¿Tenés un alojamiento? Publicalo gratis y empezá a recibir consultas hoy.',
        tags: ['publicar', 'suscriptores', 'any']
    },
    {
        id: 'promotions',
        message: '🎁 Acceso a promociones y descuentos exclusivos para miembros.',
        tags: ['suscriptores', 'any']
    }
];

function detectContextTags(pathname: string): ReadonlyArray<string> {
    const path = pathname.replace(/^\/(es|en|pt)(\/|$)/, '/');
    const tags = new Set<string>(['any']);

    if (path === '/' || path === '') {
        tags.add('home');
    }
    if (path.startsWith('/alojamientos/')) {
        tags.add('accommodation');
        tags.add(path.split('/').filter(Boolean).length > 1 ? 'detail' : 'listing');
    }
    if (path.startsWith('/destinos/')) {
        tags.add('destination');
        tags.add(path.split('/').filter(Boolean).length > 1 ? 'detail' : 'listing');
    }
    if (path.startsWith('/eventos/')) {
        tags.add('event');
        tags.add(path.split('/').filter(Boolean).length > 1 ? 'detail' : 'listing');
    }
    if (path.startsWith('/publicaciones/')) {
        tags.add('post');
        tags.add(path.split('/').filter(Boolean).length > 1 ? 'detail' : 'listing');
    }
    if (path.startsWith('/contacto')) tags.add('contact');
    if (path.startsWith('/publicar')) tags.add('publicar');
    if (path.startsWith('/suscriptores')) tags.add('suscriptores');
    if (path.startsWith('/busqueda')) tags.add('listing');

    return Array.from(tags);
}

function readShownIds(): ReadonlyArray<string> {
    try {
        const raw = sessionStorage.getItem(SHOWN_IDS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
        return [];
    }
}

function writeShownIds(ids: ReadonlyArray<string>): void {
    try {
        sessionStorage.setItem(SHOWN_IDS_KEY, JSON.stringify(ids));
    } catch {
        // Ignore quota errors.
    }
}

function readLastShownAt(): number {
    try {
        const raw = sessionStorage.getItem(LAST_SHOWN_KEY);
        if (!raw) return 0;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
}

function writeLastShownAt(timestamp: number): void {
    try {
        sessionStorage.setItem(LAST_SHOWN_KEY, String(timestamp));
    } catch {
        // Ignore.
    }
}

function readLastId(): string | null {
    try {
        return sessionStorage.getItem(LAST_ID_KEY);
    } catch {
        return null;
    }
}

function writeLastId(id: string): void {
    try {
        sessionStorage.setItem(LAST_ID_KEY, id);
    } catch {
        // Ignore.
    }
}

function pickMessage(params: {
    readonly contextTags: ReadonlyArray<string>;
    readonly shownIds: ReadonlyArray<string>;
    readonly lastId: string | null;
    readonly isFirstOfSession: boolean;
}): NudgeMessage {
    const { contextTags, shownIds, lastId, isFirstOfSession } = params;

    if (isFirstOfSession) {
        // Always start with the cross-device message — it's the most relevant
        // contextually since the visitor just changed a preference.
        const crossDevice = POOL.find((m) => m.id === 'cross-device');
        if (crossDevice) return crossDevice;
    }

    const shownSet = new Set(shownIds);
    let candidates = POOL.filter((m) => !shownSet.has(m.id) && m.id !== lastId);

    // Pool exhausted (only `lastId` excluded) — reset and pick from full pool minus lastId.
    if (candidates.length === 0) {
        candidates = POOL.filter((m) => m.id !== lastId);
        writeShownIds([]);
    }

    // Score by context tag overlap.
    const scored = candidates.map((m) => {
        const overlap = m.tags.filter((tag) => contextTags.includes(tag)).length;
        return { message: m, score: overlap };
    });

    const maxScore = scored.reduce((acc, s) => Math.max(acc, s.score), 0);
    const topPicks = scored.filter((s) => s.score === maxScore).map((s) => s.message);

    return topPicks[Math.floor(Math.random() * topPicks.length)] as NudgeMessage;
}

function isAuthenticated(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.getAttribute('data-user-authenticated') === 'true';
}

function buildSignupUrl(): string {
    const lang = document.documentElement.getAttribute('lang') ?? 'es';
    return `/${lang}${SIGNUP_PATH_PREFIX}/`;
}

function buildBenefitsUrl(): string {
    const lang = document.documentElement.getAttribute('lang') ?? 'es';
    return `/${lang}${BENEFITS_PATH_PREFIX}/`;
}

function showNudge(): void {
    if (isAuthenticated()) return;

    const now = Date.now();
    const lastShownAt = readLastShownAt();
    if (now - lastShownAt < THROTTLE_MS) return;

    const shownIds = readShownIds();
    const lastId = readLastId();
    const contextTags = detectContextTags(window.location.pathname);
    const isFirstOfSession = shownIds.length === 0;

    const picked = pickMessage({ contextTags, shownIds, lastId, isFirstOfSession });

    addToast({
        type: 'info',
        message: picked.message,
        duration: TOAST_DURATION_MS,
        action: {
            label: 'Iniciar sesión',
            href: buildSignupUrl()
        },
        secondaryAction: {
            label: 'Ver todas las ventajas',
            href: buildBenefitsUrl()
        }
    });

    writeShownIds([...shownIds, picked.id]);
    writeLastShownAt(now);
    writeLastId(picked.id);
}

/**
 * GuestPreferenceNudge - mounts a global listener for preference changes
 * and surfaces a registration nudge toast to unauthenticated visitors.
 *
 * @example
 * ```astro
 * <GuestPreferenceNudge client:idle />
 * ```
 */
export function GuestPreferenceNudge(): null {
    useEffect(() => {
        const handle = () => showNudge();
        window.addEventListener('preferences:change', handle);
        return () => {
            window.removeEventListener('preferences:change', handle);
        };
    }, []);

    return null;
}
