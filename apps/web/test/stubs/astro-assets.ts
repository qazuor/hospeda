/**
 * @file astro-assets.ts
 * @description Minimal stub for the `astro:assets` virtual module.
 *
 * `astro:assets` only exists once Astro's Vite plugins are loaded, so any module
 * importing `getImage` cannot be imported from Vitest without this. Aliased in
 * `vitest.config.ts` alongside the existing `astro:transitions/client` and
 * `astro:middleware` stubs.
 *
 * `getImage` returns a deterministic URL shaped like Astro's real image endpoint
 * so tests can assert on the generated `srcset` strings.
 */

/** Subset of `astro:assets`'s `getImage` options that this app passes. */
interface GetImageOptions {
    readonly src: { readonly src?: string } | string;
    readonly width?: number;
    readonly format?: string;
}

/** Subset of the real return value that this app reads. */
interface GetImageResult {
    readonly src: string;
}

export async function getImage({ src, width, format }: GetImageOptions): Promise<GetImageResult> {
    const href = typeof src === 'string' ? src : (src?.src ?? '/stub.jpg');
    const params = new URLSearchParams({ href });
    if (width !== undefined) params.set('w', String(width));
    if (format !== undefined) params.set('f', format);
    return { src: `/_image/?${params.toString()}` };
}
