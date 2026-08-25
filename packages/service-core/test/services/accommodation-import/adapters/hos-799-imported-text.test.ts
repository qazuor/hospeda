/**
 * HOS-799 regression tests — imported description/summary formatting.
 *
 * AAA pattern throughout.
 *
 * **What went wrong.** A listing imported from an external URL reached the
 * database with a 452-character description containing ZERO line breaks
 * ("…memorables!Nuestra quinta…") and a summary of exactly 150 characters cut
 * mid-word and terminated by three ASCII dots stored inside the value.
 *
 * **What it actually was.** The importer never stripped anything: the generic
 * adapter sourced `description` from the page's SEO metadata (JSON-LD →
 * `og:description` → `<meta name="description">`) and `summary` from
 * `og:description` verbatim. Metadata is single-line by construction and
 * routinely pre-truncated by the source's SEO plugin, so both defects were
 * properties of the SOURCE, copied through untouched. `imported-text.ts` was
 * innocent — `toDescriptionText`/`toSummaryText` were reachable only from the
 * MercadoLibre adapter.
 *
 * The end-to-end cases below drive the real pipeline
 * (`GenericAdapter.extract` → `mapRawToDraft`) with `safeExternalFetch` mocked,
 * against a page shaped like the observed one.
 */

import { describe, expect, it, vi } from 'vitest';

import { GenericAdapter } from '../../../../src/services/accommodation-import/adapters/generic.adapter.js';
import {
    normaliseSourceTruncation,
    resolveImportedDescription,
    resolveImportedSummary,
    stripLeadingTitle
} from '../../../../src/services/accommodation-import/adapters/imported-text.js';
import { mapRawToDraft } from '../../../../src/services/accommodation-import/mapping.js';

vi.mock('@repo/utils/safe-fetch', () => ({ safeExternalFetch: vi.fn() }));

import { safeExternalFetch } from '@repo/utils/safe-fetch';

const mockFetch = vi.mocked(safeExternalFetch);

// ---------------------------------------------------------------------------
// Fixtures — a page shaped like the one observed in the 25/08 smoke
// ---------------------------------------------------------------------------

const PARAGRAPHS = [
    'Bienvenidos a nuestra quinta, un lugar pensado para que tus vacaciones sean unicas y memorables!',
    'Nuestra quinta esta ubicada en Concepcion del Uruguay, en la provincia de Entre Rios.',
    'Una moderna y elegante casa con pileta climatizada, parrilla y amplio parque arbolado.'
];

/** What the source's SEO layer publishes: the same prose, flattened to one line. */
const FLAT_METADATA_DESCRIPTION = PARAGRAPHS.join(' ');

/** What a Yoast-style plugin emits: a hard 150-char cut ending in three ASCII dots. */
const PRE_TRUNCATED_OG_DESCRIPTION = `${FLAT_METADATA_DESCRIPTION.slice(0, 147)}...`;

/**
 * A page whose BODY carries the real prose in paragraphs while its METADATA is
 * flat and pre-truncated — the exact combination that produced the bug.
 */
const LISTING_HTML = `<!DOCTYPE html>
<html><head>
  <title>Quinta Los Alamos | Alquiler temporario</title>
  <meta property="og:title" content="Quinta Los Alamos">
  <meta property="og:description" content="${PRE_TRUNCATED_OG_DESCRIPTION}">
  <script type="application/ld+json">
  ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LodgingBusiness',
      name: 'Quinta Los Alamos',
      description: FLAT_METADATA_DESCRIPTION,
      telephone: '+54 3442 123456',
      address: { '@type': 'PostalAddress', streetAddress: 'Av. Urquiza 100' }
  })}
  </script>
</head><body>
  <nav><a href="/">Inicio</a><a href="/contacto">Contacto</a></nav>
  <main>
    <h1>Quinta Los Alamos</h1>
    <p>${PARAGRAPHS[0]}</p>
    <p>${PARAGRAPHS[1]}</p>
    <p>${PARAGRAPHS[2]}</p>
  </main>
  <footer>Aceptar cookies. Todos los derechos reservados.</footer>
</body></html>`;

/** Builds the successful SafeFetchResult the adapter expects. */
function successResult(html: string) {
    return {
        ok: true as const,
        status: 200,
        body: html,
        finalUrl: 'https://example.com/listing/1'
    };
}

/** Runs the full generic pipeline and returns the mapped draft. */
async function importDraft(html: string) {
    mockFetch.mockResolvedValue(successResult(html) as never);

    const raw = await new GenericAdapter().extract(new URL('https://example.com/listing/1'), {
        locale: 'es',
        timeoutMs: 10_000,
        maxBytes: 5_000_000,
        aiMaxChars: 4_000,
        credentials: {}
    });

    return mapRawToDraft({ raw }).draft;
}

// ---------------------------------------------------------------------------
// End-to-end regression (AC-2, AC-3, AC-4)
// ---------------------------------------------------------------------------

describe('HOS-799 — importing a listing whose source text has paragraphs', () => {
    it('keeps the paragraphs in the imported description', async () => {
        // Arrange — see LISTING_HTML: body has 3 paragraphs, metadata is flat.

        // Act
        const draft = await importDraft(LISTING_HTML);
        const description = draft.description?.value ?? '';

        // Assert — the reported symptom was zero line breaks. Assert on the
        // COUNT, not merely on `toContain('\n')`: one surviving break would
        // satisfy a presence check while the rest were still welded.
        expect((description.match(/\n/g) ?? []).length).toBe(4);
        for (const paragraph of PARAGRAPHS) {
            expect(description).toContain(paragraph);
        }
        // The literal welded shape from the bug report must not occur.
        expect(description).not.toContain('memorables!Nuestra');
    });

    it('sources the description from the page body, not from the flat metadata', async () => {
        // Act
        const draft = await importDraft(LISTING_HTML);

        // Assert
        expect(draft.description?.source).toBe('text');
        expect(draft.description?.value).not.toBe(FLAT_METADATA_DESCRIPTION);
    });

    it('does not import page chrome or the duplicated title into the description', async () => {
        // Act
        const draft = await importDraft(LISTING_HTML);
        const description = draft.description?.value ?? '';

        // Assert
        for (const junk of ['Inicio', 'Contacto', 'cookies', 'Todos los derechos']) {
            expect(description).not.toContain(junk);
        }
        expect(description.startsWith('Quinta Los Alamos')).toBe(false);
        expect(description).not.toContain('Alquiler temporario');
    });

    it('never stores the source’s own "..." inside the summary', async () => {
        // Arrange — the og:description really is pre-truncated, so a verbatim
        // copy would carry the marker. Guard the fixture itself, otherwise this
        // test could pass against a source that was never truncated.
        expect(PRE_TRUNCATED_OG_DESCRIPTION).toHaveLength(150);
        expect(PRE_TRUNCATED_OG_DESCRIPTION.endsWith('...')).toBe(true);

        // Act
        const draft = await importDraft(LISTING_HTML);
        const summary = draft.summary?.value ?? '';

        // Assert
        expect(summary).not.toContain('...');
        expect(summary).not.toBe(PRE_TRUNCATED_OG_DESCRIPTION);
        expect(summary).not.toHaveLength(150);
    });

    it('derives the summary from the description rather than copying og:description', async () => {
        // Act
        const draft = await importDraft(LISTING_HTML);
        const summary = draft.summary?.value ?? '';

        // Assert — same prose as the description, flattened to a single line.
        expect(summary).toContain(PARAGRAPHS[0]);
        expect(summary).not.toContain('\n');
    });

    it('does not cut the summary mid-word when the description exceeds the max', async () => {
        // Arrange — a description long enough to force truncation at 300.
        const longParagraph = `${'Una casa muy comoda y luminosa para toda la familia. '.repeat(12)}fin`;
        const html = `<html><head><title>T</title></head><body><main><p>${longParagraph}</p></main></body></html>`;

        // Act
        const draft = await importDraft(html);
        const summary = draft.summary?.value ?? '';

        // Assert — truncated, and terminated by a SINGLE U+2026 outside any word.
        expect(summary.length).toBeLessThanOrEqual(300);
        expect(summary.endsWith('…')).toBe(true);
        expect(summary).not.toContain('...');
        // The character before the ellipsis must end a whole word, never a
        // fragment: the cut lands on a word boundary.
        const withoutEllipsis = summary.slice(0, -1);
        expect(longParagraph.startsWith(withoutEllipsis)).toBe(true);
        expect(longParagraph.charAt(withoutEllipsis.length)).toBe(' ');
    });
});

// ---------------------------------------------------------------------------
// Unit tests for the resolution helpers
// ---------------------------------------------------------------------------

describe('normaliseSourceTruncation', () => {
    it('repairs a value the source clipped mid-word with three ASCII dots', () => {
        // Arrange
        const text = 'Nuestra quinta esta ubicada en Concepcion del Urug...';

        // Act
        const result = normaliseSourceTruncation({ text });

        // Assert — the broken fragment is gone and a single U+2026 marks the cut.
        expect(result).toBe('Nuestra quinta esta ubicada en Concepcion del…');
        expect(result).not.toContain('...');
        expect(result).not.toContain('Urug');
    });

    it('also repairs a value clipped with a U+2026 ellipsis', () => {
        // Arrange / Act
        const result = normaliseSourceTruncation({ text: 'Una casa en Concepcion del Urug…' });

        // Assert
        expect(result).toBe('Una casa en Concepcion del…');
    });

    it('leaves a complete value untouched', () => {
        // Arrange
        const text = 'Una casa completa con pileta.';

        // Act / Assert
        expect(normaliseSourceTruncation({ text })).toBe(text);
    });

    it('does not mistake an interior ellipsis for a truncation marker', () => {
        // Arrange
        const text = 'Pensalo... y despues reservá.';

        // Act / Assert
        expect(normaliseSourceTruncation({ text })).toBe(text);
    });
});

describe('stripLeadingTitle', () => {
    it('drops a first line that exactly repeats the title', () => {
        // Arrange / Act
        const result = stripLeadingTitle({
            text: 'Casa Azul\n\nUna casa junto al rio.',
            title: 'Casa Azul'
        });

        // Assert
        expect(result).toBe('Una casa junto al rio.');
    });

    it('keeps a first line that merely starts with the title', () => {
        // Arrange
        const text = 'Casa Azul en Colon\n\nUna casa junto al rio.';

        // Act / Assert — deleting real prose is the worse failure.
        expect(stripLeadingTitle({ text, title: 'Casa Azul' })).toBe(text);
    });

    it('is a no-op when no title is known', () => {
        // Arrange
        const text = 'Casa Azul\n\nUna casa.';

        // Act / Assert
        expect(stripLeadingTitle({ text, title: undefined })).toBe(text);
    });
});

describe('resolveImportedDescription', () => {
    const BODY_WITH_PARAGRAPHS = PARAGRAPHS.join('\n\n');

    it('prefers the body when it carries paragraph structure', () => {
        // Arrange / Act
        const result = resolveImportedDescription({
            bodyText: BODY_WITH_PARAGRAPHS,
            metadataText: FLAT_METADATA_DESCRIPTION
        });

        // Assert
        expect(result?.origin).toBe('body');
        expect(result?.text).toContain('\n');
    });

    it('falls back to the metadata when the body is too thin to trust', () => {
        // Arrange — comfortably over the 30-char schema minimum, well under the
        // trust floor for a scrape.
        const thinBody = 'Nothing useful here at all today.';
        expect(thinBody.length).toBeGreaterThan(30);

        // Act
        const result = resolveImportedDescription({
            bodyText: thinBody,
            metadataText: FLAT_METADATA_DESCRIPTION
        });

        // Assert
        expect(result?.origin).toBe('metadata');
        expect(result?.text).toBe(FLAT_METADATA_DESCRIPTION);
    });

    it('repairs the metadata truncation when the metadata wins', () => {
        // Arrange — a pre-truncated metadata value long enough to be used.
        const truncated = `${FLAT_METADATA_DESCRIPTION.slice(0, 200)}...`;

        // Act
        const result = resolveImportedDescription({ bodyText: '', metadataText: truncated });

        // Assert
        expect(result?.origin).toBe('metadata');
        expect(result?.text).not.toContain('...');
        expect(result?.text.endsWith('…')).toBe(true);
    });

    it('returns null when neither candidate is usable', () => {
        // Arrange / Act
        const result = resolveImportedDescription({ bodyText: 'corto', metadataText: undefined });

        // Assert
        expect(result).toBeNull();
    });
});

describe('resolveImportedSummary', () => {
    it('derives from the description when one exists, ignoring the metadata summary', () => {
        // Arrange / Act
        const result = resolveImportedSummary({
            descriptionText: PARAGRAPHS.join('\n\n'),
            metadataSummary: PRE_TRUNCATED_OG_DESCRIPTION
        });

        // Assert
        expect(result).not.toContain('...');
        expect(result).not.toContain('\n');
        expect(result).toContain(PARAGRAPHS[0]);
    });

    it('repairs the metadata summary when there is no description to derive from', () => {
        // Arrange / Act
        const result = resolveImportedSummary({
            descriptionText: undefined,
            metadataSummary: PRE_TRUNCATED_OG_DESCRIPTION
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result).not.toContain('...');
        expect(result?.endsWith('…')).toBe(true);
    });

    it('returns null when there is no seed at all', () => {
        // Arrange / Act / Assert
        expect(
            resolveImportedSummary({ descriptionText: undefined, metadataSummary: undefined })
        ).toBeNull();
    });
});
