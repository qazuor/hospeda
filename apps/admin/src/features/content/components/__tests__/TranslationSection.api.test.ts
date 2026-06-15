/**
 * Regression guard for the SPEC-212 TranslationSection API wiring.
 *
 * A browser smoke found that the admin "Translate now" / override actions used a
 * raw, RELATIVE `fetch('/api/v1/...')` — which resolves against the admin origin,
 * not the API server (admin and API are separate origins), and pointed at a
 * non-existent `POST /api/v1/admin/ai/translate` endpoint. Both actions were
 * therefore broken in any real deployment.
 *
 * These source-level assertions lock in the fix: the component must use the
 * `fetchApi` client (which targets the API base URL) and the correct endpoints.
 *
 * @module features/content/components/__tests__/TranslationSection.api
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../TranslationSection.tsx'), 'utf8');

describe('TranslationSection API wiring (SPEC-212)', () => {
    it('uses the fetchApi client (targets the API server), not raw fetch', () => {
        expect(src).toContain("import { fetchApi } from '@/lib/api/client'");
        expect(src).toContain('await fetchApi(');
        // No raw relative fetch() to /api — that hits the admin origin, not the API.
        expect(src).not.toMatch(/fetch\(\s*['"]\/api\//);
    });

    it('translates a single entity via the admin translate endpoint (POST)', () => {
        expect(src).toContain("path: '/api/v1/admin/ai/translate'");
        expect(src).toContain("method: 'POST'");
    });

    it('saves a manual override via the override endpoint (PUT)', () => {
        expect(src).toContain("path: '/api/v1/admin/ai/translate/override'");
        expect(src).toContain("method: 'PUT'");
    });
});
