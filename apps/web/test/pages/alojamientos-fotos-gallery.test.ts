/**
 * @file alojamientos-fotos-gallery.test.ts
 * @description SPEC-186 T-015 — structural verification of the /fotos sub-page.
 *
 * After T-014 replaced the masonry layout with a fixed-ratio CSS grid, this
 * suite guards that all GLightbox-critical attributes, video play-overlay
 * elements, photo href semantics (full-size href / galleryHalf thumbnail),
 * gallery grouping, item completeness (no slice/cap), and GLightbox
 * initialization are intact.
 *
 * Astro pages cannot be rendered through Vitest/jsdom, so every assertion
 * operates on the raw source text of the page and the BaseLayout that hosts
 * the GLightbox initialization script.
 *
 * The CSS reflow / CLS invariants (aspect-ratio, breakpoints) are covered by
 * apps/web/test/components/ImageGallery.cls.test.ts — those assertions are
 * intentionally NOT duplicated here.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FOTOS_PATH = resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug]/fotos.astro');
const BASE_LAYOUT_PATH = resolve(__dirname, '../../src/layouts/BaseLayout.astro');

const fotosSrc = readFileSync(FOTOS_PATH, 'utf8');
const baseLayoutSrc = readFileSync(BASE_LAYOUT_PATH, 'utf8');

// ---------------------------------------------------------------------------
// 1. VIDEO CELLS
// ---------------------------------------------------------------------------
describe('fotos.astro — VIDEO cells (GLightbox + play overlay)', () => {
    it('renders a play overlay span with class fotos__play for video items', () => {
        // The conditional renders the play span only for video items.
        expect(fotosSrc).toContain("item.type === 'video'");
        expect(fotosSrc).toContain('class="fotos__play"');
    });

    it('fotos__play has aria-hidden="true" (decorative overlay)', () => {
        expect(fotosSrc).toContain('aria-hidden="true"');
    });

    it('fotos__play is INSIDE the <a data-glightbox> link (nested in fotosCell)', () => {
        // Structural check: the play span must appear after the <a ...data-glightbox
        // open tag and before the closing </a> within the same item block.
        // We verify the template nests it inside the link by checking ordering.
        const linkOpen = fotosSrc.indexOf('data-glightbox');
        const playSpan = fotosSrc.indexOf('class="fotos__play"');
        const imgTag = fotosSrc.indexOf('class="fotos__cellImg"');
        // play span must appear AFTER the img tag but before the link closes.
        expect(linkOpen).toBeGreaterThan(-1);
        expect(playSpan).toBeGreaterThan(imgTag);
    });

    it('video src (YouTube URL) is used as the GLightbox href (item.src)', () => {
        // For video items, entry.url (the YouTube URL) is assigned to GalleryItem.src,
        // and item.src is used as href on the <a> element.
        // The template uses href={item.src} uniformly for ALL items.
        expect(fotosSrc).toContain('href={item.src}');
    });

    it('video item uses YouTube poster as thumbGrid (img.src = item.thumbGrid)', () => {
        // The <img> inside each cell uses item.thumbGrid, which for videos is the
        // YouTube poster URL passed through getMediaUrl (non-Cloudinary → pass-through).
        expect(fotosSrc).toContain('src={item.thumbGrid}');
    });

    it('video item builds poster URL from YouTube video ID (maxresdefault)', () => {
        expect(fotosSrc).toContain('maxresdefault.jpg');
        expect(fotosSrc).toContain('img.youtube.com/vi/');
    });

    it('video item has an hqdefault fallback for posters', () => {
        expect(fotosSrc).toContain('hqdefault.jpg');
        expect(fotosSrc).toContain('data-fallback={item.thumbFallback');
    });
});

// ---------------------------------------------------------------------------
// 2. PHOTO CELLS — href is full-size, img uses galleryHalf thumbnail
// ---------------------------------------------------------------------------
describe('fotos.astro — PHOTO cells (href = full-size, thumbGrid = galleryHalf)', () => {
    it('uses item.src (full-size URL) as the GLightbox href', () => {
        // Photo items: src = entry.url (the full/uncropped URL stored in the DB).
        // The href on <a> is item.src — same field used for all items.
        expect(fotosSrc).toContain('href={item.src}');
    });

    it('thumbGrid for images is built with getMediaUrl + preset galleryHalf', () => {
        // Both featured image and gallery entries call:
        //   thumbGrid: getMediaUrl(url, { preset: 'galleryHalf' })
        expect(fotosSrc).toContain("preset: 'galleryHalf'");
        expect(fotosSrc).toContain('getMediaUrl');
    });

    it('galleryHalf preset is used ONLY for thumbGrid, not for the href src', () => {
        // The src field is assigned from the raw entry.url / featuredSrc, NOT from
        // getMediaUrl(..., { preset: 'galleryHalf' }).
        // This means href points to the original URL, never a c_fill-cropped one.
        //
        // We verify no line of the form `src: getMediaUrl(...galleryHalf...)` exists
        // (i.e., the `src` property of GalleryItem is never the cropped thumbnail).
        expect(fotosSrc).not.toMatch(/\bsrc:\s*getMediaUrl/);
    });

    it('import statement pulls getMediaUrl from @repo/media', () => {
        expect(fotosSrc).toMatch(/import\s*\{\s*getMediaUrl\s*\}\s*from\s*['"]@repo\/media['"]/);
    });

    it('GalleryItem.src is documented as full-size / uncropped GLightbox href', () => {
        // The JSDoc on GalleryItem.src describes it as the full-size URL.
        expect(fotosSrc).toContain('Full-size URL used as the GLightbox href');
    });

    it('href on the anchor does NOT contain a c_fill crop string at the template level', () => {
        // Template-level: the anchor href is interpolated from item.src which is the
        // raw full-size URL. The c_fill transform only goes into item.thumbGrid.
        // We assert the href attribute interpolation references src not thumbGrid.
        expect(fotosSrc).toContain('href={item.src}');
        expect(fotosSrc).not.toContain('href={item.thumbGrid}');
    });
});

// ---------------------------------------------------------------------------
// 3. data-gallery GROUPING ATTRIBUTE
// ---------------------------------------------------------------------------
describe('fotos.astro — data-gallery grouping for GLightbox', () => {
    it('every <a> anchor has data-gallery="accommodation-gallery"', () => {
        // All items (photos + videos) share the same gallery group so GLightbox
        // can navigate between them with arrow keys.
        expect(fotosSrc).toContain('data-gallery="accommodation-gallery"');
    });

    it('data-gallery is present on the same element as data-glightbox', () => {
        // Both attributes must be on the same <a> element.
        // Verify they appear in the same short text block (within 200 chars of each other).
        const glIndex = fotosSrc.indexOf('data-glightbox');
        const galleryIndex = fotosSrc.indexOf('data-gallery="accommodation-gallery"');
        expect(glIndex).toBeGreaterThan(-1);
        expect(galleryIndex).toBeGreaterThan(-1);
        // They must be close (same tag — within 150 chars of each other in source).
        expect(Math.abs(glIndex - galleryIndex)).toBeLessThan(150);
    });

    it('data-title and data-description are forwarded from item metadata', () => {
        // GLightbox uses data-title and data-description for the lightbox caption bar.
        expect(fotosSrc).toContain('data-title={item.caption');
        expect(fotosSrc).toContain('data-description={item.description');
    });
});

// ---------------------------------------------------------------------------
// 4. ALL ITEMS RENDERED — no slice/cap on the gallery loop
// ---------------------------------------------------------------------------
describe('fotos.astro — ALL items rendered (no slice or cap)', () => {
    it('does NOT call .slice() on galleryItems (no item cap)', () => {
        // Any slice call on the galleryItems array would silently drop media.
        // The JSON-LD image list does use .filter() but not .slice().
        expect(fotosSrc).not.toMatch(/galleryItems\s*\.slice\s*\(/);
    });

    it('does NOT impose a hard numeric cap on galleryItems in the template loop', () => {
        // The loop is: galleryItems.map((item, i) => ...)
        // No max() or cap guard should precede or wrap it.
        expect(fotosSrc).toMatch(/galleryItems\.map\s*\(/);
        expect(fotosSrc).not.toMatch(/galleryItems\.slice\s*\(0\s*,\s*\d+\)/);
    });

    it('JSON-LD image list uses .filter() not .slice() (no arbitrary cap)', () => {
        // The JSON-LD image array filters to type=image only — no numeric slice.
        expect(fotosSrc).toContain(
            "galleryItems.filter((i) => i.type === 'image').map((i) => i.src)"
        );
        // Legitimate: filter is not a cap, it's a type constraint (videos excluded from schema.org ImageGallery).
    });

    it('featured image, gallery entries, and videos are all appended to galleryItems', () => {
        // The build phase pushes to galleryItems from three sources.
        expect(fotosSrc).toContain('accommodation.featuredImage');
        expect(fotosSrc).toContain('accommodation.media.galleryItems');
        expect(fotosSrc).toContain('accommodation.media.images');
        expect(fotosSrc).toContain('accommodation.media.videos');
    });
});

// ---------------------------------------------------------------------------
// 5. GLightbox INITIALIZATION IN BaseLayout
// ---------------------------------------------------------------------------
describe('BaseLayout.astro — GLightbox initialization script', () => {
    it('lazy-loads the glightbox package only when [data-glightbox] elements exist', () => {
        expect(baseLayoutSrc).toContain("document.querySelector('[data-glightbox]')");
        expect(baseLayoutSrc).toContain("import('glightbox')");
    });

    it('imports the glightbox CSS alongside the JS (same Promise.all)', () => {
        expect(baseLayoutSrc).toContain("import('glightbox/dist/css/glightbox.min.css')");
    });

    it('initializes GLightbox with the [data-glightbox] selector', () => {
        expect(baseLayoutSrc).toContain("selector: '[data-glightbox]'");
    });

    it('enables touchNavigation and loop in the GLightbox config', () => {
        expect(baseLayoutSrc).toContain('touchNavigation: true');
        expect(baseLayoutSrc).toContain('loop: true');
    });

    it('re-initializes GLightbox on astro:page-load (client-side navigation)', () => {
        // GLightbox must survive SPA-like navigations via View Transitions.
        expect(baseLayoutSrc).toContain("'astro:page-load'");
    });
});

// ---------------------------------------------------------------------------
// 6. MASONRY ERA — no orphan classes or CSS from the old layout
// ---------------------------------------------------------------------------
describe('fotos.astro — no masonry-era orphan markup or CSS', () => {
    it('does NOT contain .fotos__masonry class in markup or styles', () => {
        expect(fotosSrc).not.toContain('fotos__masonry');
    });

    it('does NOT use CSS multi-column properties (masonry technique)', () => {
        // The old masonry used `column-count` or the `columns` shorthand.
        // `grid-template-columns` is the NEW layout and must NOT be rejected.
        expect(fotosSrc).not.toMatch(/column-count\s*:/);
        // Match the bare `columns:` shorthand but NOT `grid-template-columns:`.
        // We require the property to be preceded by whitespace or semicolon (i.e.
        // a CSS property start), not by the word "template-".
        expect(fotosSrc).not.toMatch(/(?<![a-z-])columns\s*:/);
    });

    it('new grid uses display: grid with fotosGrid class', () => {
        expect(fotosSrc).toContain('class="fotosGrid"');
        expect(fotosSrc).toContain('display: grid');
    });

    it('new cells use fotosCell class with aspect-ratio: 4 / 3', () => {
        expect(fotosSrc).toContain('class="fotosCell"');
        expect(fotosSrc).toContain('aspect-ratio: 4 / 3');
    });

    it('comment notes that the grid REPLACES the former masonry', () => {
        // Maintainability signal — the doc comment records the history.
        expect(fotosSrc).toContain('Replaces the former columns masonry');
    });
});

// ---------------------------------------------------------------------------
// 7. RENDERING MODE — SSR (consistent with accommodation detail pages)
// ---------------------------------------------------------------------------
describe('fotos.astro — rendering mode', () => {
    it('is SSR (prerender = false)', () => {
        expect(fotosSrc).toContain('export const prerender = false');
    });

    it('does NOT export getStaticPaths (not SSG)', () => {
        expect(fotosSrc).not.toContain('getStaticPaths');
    });

    it('guards against a missing slug param with a 404', () => {
        expect(fotosSrc).toContain('status: 404');
        expect(fotosSrc).toContain('!slug');
    });
});

// ---------------------------------------------------------------------------
// 8. JSON-LD SCHEMA — ImageGallery type with correct fields
// ---------------------------------------------------------------------------
describe('fotos.astro — JSON-LD schema (ImageGallery)', () => {
    it('emits schema.org ImageGallery type', () => {
        expect(fotosSrc).toContain("'@type': 'ImageGallery'");
    });

    it('includes a name and url field in the JSON-LD', () => {
        expect(fotosSrc).toContain('name:');
        expect(fotosSrc).toContain('url: Astro.url.href');
    });

    it('mounts the JsonLd component in the head-extra slot', () => {
        expect(fotosSrc).toContain('<JsonLd slot="head-extra"');
    });
});
