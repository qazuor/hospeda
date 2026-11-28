/**
 * @file umami-script.test.ts
 * @description Source-level tests for `UmamiScript.astro` (HOS-2119 T-028).
 *
 * Vitest cannot render `.astro` in this repo (see
 * `test/components/listing/location/LocationSection.test.ts`), so these
 * assertions read the SOURCE. They prove the tag is spelled the way the
 * contract requires, not that a given env combination takes a given branch.
 * The definitive check is the staging deploy, where the rendered `<head>` must
 * carry exactly one `<script defer src=... data-website-id=...>`.
 *
 * Contract under test:
 * - external deferred script from `PUBLIC_UMAMI_SCRIPT_URL` with
 *   `data-website-id` from `PUBLIC_UMAMI_WEBSITE_ID`;
 * - rendered only when BOTH values are set;
 * - `data-auto-pageview="false"`: pageviews come from the bundled
 *   `startUmamiPageviews` script on `astro:page-load` (C1), while auto-track
 *   stays on so custom events keep the current URL;
 * - the tracker tag has no inline body (so the CSP needs no hash), the
 *   pageview script is a processed (bundled) Astro script, and nothing reads
 *   per-user data (the page must stay session-blind);
 * - no `data-host-url` (the script origin is the Umami host);
 * - only `BaseLayout` and `StandaloneLayout` render it, and neither renders
 *   the removed PostHog snippet any more.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../../src');
const read = (relative: string): string => readFileSync(resolve(SRC_ROOT, relative), 'utf8');

/** Source with `/** ... *\/` blocks and `<!-- -->` comments removed. */
const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

const COMPONENT = read('components/analytics/UmamiScript.astro');
const COMPONENT_CODE = stripComments(COMPONENT);
/** The template part, i.e. everything after the closing frontmatter fence. */
const TEMPLATE = COMPONENT_CODE.split(/^---\s*$/m)
    .slice(2)
    .join('---');

describe('UmamiScript — the tag when configured', () => {
    it('renders an inert config meta with the URL from PUBLIC_UMAMI_SCRIPT_URL, never the tracker script (HOS-2681)', () => {
        expect(COMPONENT_CODE).toContain('PUBLIC_UMAMI_SCRIPT_URL');
        expect(TEMPLATE).toMatch(/<meta name="umami-config"[^>]*\bdata-script-url=\{scriptUrl\}/);
        // The tracker tag is injected client-side only after analytics consent.
        expect(TEMPLATE).not.toMatch(/<script\b[^>]*\bsrc=/);
    });

    it('carries data-website-id from PUBLIC_UMAMI_WEBSITE_ID in the config meta', () => {
        expect(COMPONENT_CODE).toContain('PUBLIC_UMAMI_WEBSITE_ID');
        expect(TEMPLATE).toMatch(/<meta name="umami-config"[^>]*\bdata-website-id=\{websiteId\}/);
    });

    it('does not set data-host-url (the script origin is the Umami host)', () => {
        expect(COMPONENT_CODE).not.toContain('data-host-url');
    });

    it('turns off the automatic pageview only (set by the loader), never auto-track', () => {
        expect(read('lib/analytics/umami-loader.ts')).toContain("'data-auto-pageview', 'false'");
        // auto-track=false would stop the tracker following pushState, freezing
        // the URL of every custom event at the landing page.
        expect(COMPONENT_CODE).not.toContain('data-auto-track');
    });

    it('starts the consent-gated loader, the pageview and the recorder loader from one bundled script', () => {
        expect(TEMPLATE).toMatch(
            /<script>\s*import \{ startUmamiLoader \} from '@\/lib\/analytics\/umami-loader';\s*import \{ startUmamiPageviews \} from '@\/lib\/analytics\/umami-pageview';\s*import \{ startUmamiRecorder \} from '@\/lib\/analytics\/umami-recorder';\s*startUmamiLoader\(\);\s*startUmamiPageviews\(\);\s*startUmamiRecorder\(\);\s*<\/script>/
        );
    });
});

describe('UmamiScript — first-pageview identity hold (OQ-5)', () => {
    it('renders the await-identity meta only behind the gate and the prop', () => {
        expect(TEMPLATE).toMatch(
            /shouldRender && awaitIdentity && <meta name="umami-await-identity" content="true" \/>/
        );
    });

    it('BaseLayout (mounts UserMenu) asks for it and StandaloneLayout (no UserMenu) does not', () => {
        expect(stripComments(read('layouts/BaseLayout.astro'))).toMatch(
            /<UmamiScript\b[^>]*\bawaitIdentity\b[^>]*\/>/
        );
        expect(stripComments(read('layouts/StandaloneLayout.astro'))).not.toContain(
            'awaitIdentity'
        );
    });
});

describe('UmamiScript — the tag when not configured', () => {
    it('requires BOTH the script URL and the website id to render', () => {
        // Dropping either half would ship a broken tag (no src, or no id).
        expect(COMPONENT_CODE).toMatch(/shouldRender\s*=\s*Boolean\(scriptUrl\s*&&\s*websiteId\)/);
        expect(TEMPLATE).toContain('shouldRender &&');
    });

    it('renders the config meta only behind the gate', () => {
        expect(TEMPLATE).toMatch(/shouldRender && <meta name="umami-config"/);
    });

    it('renders exactly one script element: the bundled wiring script', () => {
        expect(TEMPLATE.match(/<script\b/g)).toHaveLength(1);
    });
});

describe('UmamiScript — no inline body, no per-user data', () => {
    it('has no set:html / define:vars / is:inline (no hand-hashed inline script)', () => {
        expect(TEMPLATE).not.toMatch(/set:html|define:vars|is:inline/);
    });

    it('injects the tracker tag from the loader as an external script with no inline body', () => {
        const loader = read('lib/analytics/umami-loader.ts');
        expect(loader).toContain('script.src = config.scriptUrl');
        expect(loader).not.toMatch(/textContent|innerHTML|\.text\s*=/);
    });

    it('reads no request, session, cookie or locals data', () => {
        expect(COMPONENT_CODE).not.toMatch(/Astro\.(request|locals|cookies|url)|getSession/);
    });
});

describe('UmamiScript — wiring', () => {
    const IMPORT_RE = /components\/analytics\/UmamiScript\.astro/;

    const listSourceFiles = (dir: string): readonly string[] =>
        readdirSync(dir).flatMap((name) => {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) return listSourceFiles(full);
            return /\.(astro|ts|tsx)$/.test(name) ? [full] : [];
        });

    it('is imported by BaseLayout and StandaloneLayout and by nothing else', () => {
        const importers = listSourceFiles(SRC_ROOT)
            .filter((file) => IMPORT_RE.test(readFileSync(file, 'utf8')))
            .map((file) => file.slice(SRC_ROOT.length + 1))
            .sort();
        expect(importers).toEqual(['layouts/BaseLayout.astro', 'layouts/StandaloneLayout.astro']);
    });

    it.each([
        'layouts/BaseLayout.astro',
        'layouts/StandaloneLayout.astro'
    ])('%s renders <UmamiScript /> and no longer renders <PostHogScript />', (layout) => {
        const code = stripComments(read(layout));
        expect(code).toContain('<UmamiScript');
        expect(code).not.toContain('PostHogScript');
    });
});
