/** Geographic extent of valid listing markers; no bounds for an empty set. */
export function listingBounds({
    points
}: {
    readonly points: readonly ({ readonly lat: number; readonly lng: number } | undefined | null)[];
}) {
    const valid = points.filter(
        (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    );
    if (!valid.length) return { bounds: undefined };
    const lat = valid.map((point) => point?.lat ?? 0);
    const lng = valid.map((point) => point?.lng ?? 0);
    const bounds: [[number, number], [number, number]] = [
        [Math.min(...lat), Math.min(...lng)],
        [Math.max(...lat), Math.max(...lng)]
    ];
    return { bounds };
}
