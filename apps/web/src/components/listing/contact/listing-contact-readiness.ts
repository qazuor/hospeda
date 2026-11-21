const readyPanels = new Set<string>();
const subscribers = new Set<() => void>();

/** Reports whether the panel's client island is listening for open requests. */
export function isListingContactPanelReady({ panelId }: { readonly panelId: string }): boolean {
    return readyPanels.has(panelId);
}

/** Subscribes a trigger island to panel readiness changes. */
export function subscribeToListingContactReadiness(notify: () => void): () => void {
    subscribers.add(notify);
    return () => subscribers.delete(notify);
}

/** Announces an installed panel listener and returns the readiness cleanup. */
export function markListingContactPanelReady({
    panelId
}: {
    readonly panelId: string;
}): () => void {
    readyPanels.add(panelId);
    for (const notify of subscribers) notify();
    return () => {
        readyPanels.delete(panelId);
        for (const notify of subscribers) notify();
    };
}
