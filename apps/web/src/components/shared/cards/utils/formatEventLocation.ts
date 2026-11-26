/** Join the distinct, nonempty venue and locality names. */
export function formatEventLocation({
    name,
    city
}: {
    readonly name?: string;
    readonly city?: string;
}): string {
    const venue = name?.trim() ?? '';
    const locality = city?.trim() ?? '';
    if (venue.localeCompare(locality, 'es', { sensitivity: 'base' }) === 0) return venue;
    return [venue, locality].filter(Boolean).join(', ');
}
