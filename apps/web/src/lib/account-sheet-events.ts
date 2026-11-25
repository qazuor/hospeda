/** Cross-island account-sheet requests. Each page owns one subscriber. */
const OPEN_ACCOUNT_SHEET_EVENT = 'hospeda:open-account-sheet';

/** Requests the current page's account sheet without retaining global state. */
export function openAccountSheet(): void {
    if (typeof window !== 'undefined')
        window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_SHEET_EVENT));
}

/** Subscribes to sheet requests and returns an SSR-safe cleanup function. */
export function onOpenAccountSheet(cb: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;
    window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, cb);
    return () => window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, cb);
}
