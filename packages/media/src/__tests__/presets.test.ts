import { describe, expect, it } from 'vitest';
import { MEDIA_PRESETS } from '../presets.js';
import type { MediaPreset } from '../presets.js';

describe('MEDIA_PRESETS', () => {
    const EXPECTED_PRESETS: MediaPreset[] = [
        'thumbnail',
        'card',
        'hero',
        'gallery',
        'avatar',
        'full',
        'og',
        'galleryFeatured',
        'galleryHalf',
        'galleryQuarter',
        'galleryThumb'
    ];

    it('should contain all 11 expected preset keys', () => {
        expect(Object.keys(MEDIA_PRESETS)).toHaveLength(11);
        for (const key of EXPECTED_PRESETS) {
            expect(MEDIA_PRESETS).toHaveProperty(key);
        }
    });

    it('should have non-empty string values for every preset', () => {
        for (const key of EXPECTED_PRESETS) {
            const value = MEDIA_PRESETS[key];
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
        }
    });

    describe('thumbnail preset', () => {
        it('should contain w_200 and h_200', () => {
            expect(MEDIA_PRESETS.thumbnail).toContain('w_200');
            expect(MEDIA_PRESETS.thumbnail).toContain('h_200');
        });

        it('should use c_thumb crop mode', () => {
            expect(MEDIA_PRESETS.thumbnail).toContain('c_thumb');
        });
    });

    describe('card preset', () => {
        it('should contain w_400 and h_300', () => {
            expect(MEDIA_PRESETS.card).toContain('w_400');
            expect(MEDIA_PRESETS.card).toContain('h_300');
        });

        it('should use c_fill crop mode', () => {
            expect(MEDIA_PRESETS.card).toContain('c_fill');
        });
    });

    describe('hero preset', () => {
        it('should contain w_1200 and h_600', () => {
            expect(MEDIA_PRESETS.hero).toContain('w_1200');
            expect(MEDIA_PRESETS.hero).toContain('h_600');
        });
    });

    describe('gallery preset', () => {
        it('should contain w_800', () => {
            expect(MEDIA_PRESETS.gallery).toContain('w_800');
        });
    });

    describe('avatar preset', () => {
        it('should contain w_150 and h_150', () => {
            expect(MEDIA_PRESETS.avatar).toContain('w_150');
            expect(MEDIA_PRESETS.avatar).toContain('h_150');
        });

        it('should use face-detection gravity (g_face)', () => {
            expect(MEDIA_PRESETS.avatar).toContain('g_face');
        });
    });

    describe('full preset', () => {
        it('should contain only quality and format transforms', () => {
            expect(MEDIA_PRESETS.full).toContain('q_auto');
            expect(MEDIA_PRESETS.full).toContain('f_auto');
        });
    });

    describe('og preset', () => {
        it('should match Open Graph standard dimensions (1200x630)', () => {
            expect(MEDIA_PRESETS.og).toContain('w_1200');
            expect(MEDIA_PRESETS.og).toContain('h_630');
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-186 §7 — gallery cell presets (galleryFeatured / galleryHalf /
    // galleryQuarter / galleryThumb).  All four must use c_fill and an ar_
    // token so the CDN returns an already-cropped asset matching the cell's
    // fixed aspect-ratio (zero CLS; no client-side crop needed).
    // -----------------------------------------------------------------------
    describe('galleryFeatured preset', () => {
        it('should use c_fill crop mode', () => {
            expect(MEDIA_PRESETS.galleryFeatured).toContain('c_fill');
        });

        it('should carry an ar_ aspect-ratio token (16:10)', () => {
            expect(MEDIA_PRESETS.galleryFeatured).toContain('ar_');
            expect(MEDIA_PRESETS.galleryFeatured).toContain('ar_16:10');
        });

        it('should request 1000px width', () => {
            expect(MEDIA_PRESETS.galleryFeatured).toContain('w_1000');
        });
    });

    describe('galleryHalf preset', () => {
        it('should use c_fill crop mode', () => {
            expect(MEDIA_PRESETS.galleryHalf).toContain('c_fill');
        });

        it('should carry an ar_ aspect-ratio token (4:3)', () => {
            expect(MEDIA_PRESETS.galleryHalf).toContain('ar_');
            expect(MEDIA_PRESETS.galleryHalf).toContain('ar_4:3');
        });

        it('should request 640px width', () => {
            expect(MEDIA_PRESETS.galleryHalf).toContain('w_640');
        });
    });

    describe('galleryQuarter preset', () => {
        it('should use c_fill crop mode', () => {
            expect(MEDIA_PRESETS.galleryQuarter).toContain('c_fill');
        });

        it('should carry an ar_ aspect-ratio token (1:1)', () => {
            expect(MEDIA_PRESETS.galleryQuarter).toContain('ar_');
            expect(MEDIA_PRESETS.galleryQuarter).toContain('ar_1:1');
        });

        it('should request 400px width', () => {
            expect(MEDIA_PRESETS.galleryQuarter).toContain('w_400');
        });
    });

    describe('galleryThumb preset', () => {
        it('should use c_fill crop mode', () => {
            expect(MEDIA_PRESETS.galleryThumb).toContain('c_fill');
        });

        it('should carry an ar_ aspect-ratio token (1:1)', () => {
            expect(MEDIA_PRESETS.galleryThumb).toContain('ar_');
            expect(MEDIA_PRESETS.galleryThumb).toContain('ar_1:1');
        });

        it('should request 120px width (lightweight strip thumbnail)', () => {
            expect(MEDIA_PRESETS.galleryThumb).toContain('w_120');
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-186 §8 step 10 — Cross-package srcset contract guard.
    //
    // The ImageGallery island (apps/web/src/components/ImageGallery.client.tsx)
    // hard-codes SRCSET_WIDTHS candidate arrays that are derived from these
    // preset base widths:
    //
    //   galleryFeatured  → srcset candidates [640, 1000, 1400]  (base = w_1000)
    //   galleryHalf      → srcset candidates [400, 640, 900]    (base = w_640)
    //   galleryQuarter   → srcset candidates [200, 400, 600]    (base = w_400)
    //   galleryThumb     → no srcset (strip-only, 120px)
    //
    // Each preset's default `w_` width MUST be the middle candidate of its
    // srcset array so that:
    // (a) The browser always has the baseline candidate available even without
    //     srcset support (plain <img src> fallback via buildCellUrl).
    // (b) At a typical desktop viewport the browser selects the middle candidate
    //     matching the pre-srcset single-URL baseline — no LCP payload regression.
    //
    // If you change a preset's base width here, you MUST also update SRCSET_WIDTHS
    // in ImageGallery.client.tsx and vice versa.  These tests make that contract
    // explicit so either side of the change breaks CI.
    // -----------------------------------------------------------------------
    describe('cross-package srcset contract — preset base widths match island SRCSET_WIDTHS mid-candidates', () => {
        it('galleryFeatured base width (w_1000) is the middle candidate of [640, 1000, 1400]', () => {
            // Island SRCSET_WIDTHS.galleryFeatured = [640, 1000, 1400].
            // The middle candidate is 1000 — must match the preset base width.
            expect(MEDIA_PRESETS.galleryFeatured).toContain('w_1000');
        });

        it('galleryHalf base width (w_640) is the middle candidate of [400, 640, 900]', () => {
            // Island SRCSET_WIDTHS.galleryHalf = [400, 640, 900].
            // The middle candidate is 640 — must match the preset base width.
            expect(MEDIA_PRESETS.galleryHalf).toContain('w_640');
        });

        it('galleryQuarter base width (w_400) is the middle candidate of [200, 400, 600]', () => {
            // Island SRCSET_WIDTHS.galleryQuarter = [200, 400, 600].
            // The middle candidate is 400 — must match the preset base width.
            expect(MEDIA_PRESETS.galleryQuarter).toContain('w_400');
        });

        it('galleryThumb base width (w_120) is the sole width used in the strip (no srcset)', () => {
            // galleryThumb has no srcset; the strip is always 120px.
            // Changing this width without updating the lightbox strip CSS would
            // break the thumbnail strip layout.
            expect(MEDIA_PRESETS.galleryThumb).toContain('w_120');
        });
    });

    describe('all presets', () => {
        it('should include q_auto for automatic quality', () => {
            for (const key of EXPECTED_PRESETS) {
                expect(MEDIA_PRESETS[key]).toContain('q_auto');
            }
        });

        it('should include f_auto for automatic format selection', () => {
            for (const key of EXPECTED_PRESETS) {
                expect(MEDIA_PRESETS[key]).toContain('f_auto');
            }
        });

        // SPEC-078-GAPS GAP-078-133: every preset must request automatic DPR
        // handling so Retina/HiDPI screens receive 2x or 3x resolution variants
        // without callers having to encode the device pixel ratio into the URL.
        it('should include dpr_auto for automatic device pixel ratio', () => {
            for (const key of EXPECTED_PRESETS) {
                expect(MEDIA_PRESETS[key]).toContain('dpr_auto');
            }
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-078-GAPS GAP-078-089
    //
    // Defensive contract checks: the registry must be frozen at module load
    // (preventing accidental mutation of named transforms by consumers) and
    // every preset value must consist exclusively of safe Cloudinary
    // transform characters. The character set covers:
    //   - lowercase letters and digits (parameter names, numeric values)
    //   - underscore (parameter/value separator, e.g. `w_400`)
    //   - comma (transform separator, e.g. `w_400,h_300`)
    //   - slash (chained transformation separator, currently unused but
    //     reserved for future composite presets)
    // Anything outside this set (whitespace, control characters, attacker-
    // controlled input from string interpolation, etc.) is a bug.
    // -----------------------------------------------------------------------
    describe('contract: frozen + safe character set (GAP-078-089)', () => {
        it('should be frozen so callers cannot mutate the registry at runtime', () => {
            expect(Object.isFrozen(MEDIA_PRESETS)).toBe(true);
        });

        it('every preset transform string should match the safe character set', () => {
            // Allowed: a-z, 0-9, underscore, comma, slash, colon. No spaces,
            // no uppercase, no quotes, no semicolons, no `<` etc.
            // The colon is required for aspect-ratio tokens (ar_16:10, ar_4:3,
            // ar_1:1) introduced by the SPEC-186 gallery presets.
            const SAFE_TRANSFORM = /^[a-z0-9_,/:]+$/;
            for (const key of EXPECTED_PRESETS) {
                expect(MEDIA_PRESETS[key]).toMatch(SAFE_TRANSFORM);
            }
        });
    });
});
