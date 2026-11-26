const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Select the single status allowed beside the favorite control on a card image. */
export function selectCardPhotoBadge({
    isFeatured,
    createdAt,
    now = Date.now()
}: {
    readonly isFeatured?: boolean;
    readonly createdAt?: string | null;
    readonly now?: number;
}): 'featured' | 'new' | null {
    if (isFeatured) return 'featured';
    const age = createdAt ? now - Date.parse(createdAt) : Number.NaN;
    return age >= 0 && age < NEW_WINDOW_MS ? 'new' : null;
}
