import { extractPublicId } from '@repo/media';

/** Classifies unique Hospeda Cloudinary assets that are safe to delete. */
export function classifyPartnerRemoteAssets(input: {
    readonly urls: readonly (string | null | undefined)[];
    readonly cloudName: string | null;
}): { readonly publicIds: readonly string[]; readonly skipped: number } {
    const publicIds: string[] = [];
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    let skipped = 0;

    for (const rawUrl of input.urls) {
        const url = rawUrl?.trim();
        if (!url) continue;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            skipped += 1;
            continue;
        }
        const firstPathSegment = parsed.pathname.split('/').filter(Boolean)[0];
        const publicId = extractPublicId(url);
        if (
            parsed.hostname !== 'res.cloudinary.com' ||
            !input.cloudName ||
            firstPathSegment !== input.cloudName ||
            !publicId ||
            !publicId.startsWith('hospeda/')
        ) {
            skipped += 1;
            continue;
        }
        if (!seenIds.has(publicId)) {
            seenIds.add(publicId);
            publicIds.push(publicId);
        }
    }

    return { publicIds, skipped };
}
