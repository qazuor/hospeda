/**
 * @file build-index.ts
 * @description Builds `help-index.json` from the content files (HOS-2410 spec
 * §5.2, `docs/data-model.md` §4): parse and validate every article, then
 * serialize the index deterministically. `pnpm help:build` writes the result;
 * guard (a) compares it with the committed file (a8).
 *
 * Generator only: it reads the file system (AC-12).
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HelpArticle, HelpIndex } from '../article.schema';
import { HELP_FOLDERS, HELP_INDEX_VERSION, HELP_LOCALES } from '../constants';
import { toCanonicalJson } from './canonical-json';
import { type HelpCatalogIssue, helpIssue } from './issues';
import { parseHelpArticle } from './parse-article';
import { type ParsedHelpEntry, validateHelpCatalog } from './validate-catalog';

/** The package's content dir. */
export const HELP_CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));

/** The package's committed index. */
export const HELP_INDEX_FILE = fileURLToPath(
    new URL('../../generated/help-index.json', import.meta.url)
);

/** One content file. */
export interface HelpContentFile {
    /** Path relative to the content dir, with `/` separators (`es/common/photos.md`). */
    readonly path: string;
    /** The file content. */
    readonly source: string;
}

/** What {@link buildHelpIndex} produced. */
export interface BuildHelpIndexResult {
    /** The index, when every file parsed. Cross-article issues do not prevent it. */
    readonly index?: HelpIndex;
    /** The index serialized as it must be committed, when it was built. */
    readonly json?: string;
    /** Every problem found. Empty means the catalog is clean. */
    readonly issues: readonly HelpCatalogIssue[];
    /** How many content files were read. */
    readonly fileCount: number;
}

/**
 * Reads every file under a content dir.
 *
 * @param args.contentDir - The content dir; defaults to the package's
 * @returns The files, sorted by path. An absent dir reads as no files.
 */
export function readHelpContentFiles({
    contentDir = HELP_CONTENT_DIR
}: {
    readonly contentDir?: string;
} = {}): HelpContentFile[] {
    const files: HelpContentFile[] = [];
    const walk = (dir: string) => {
        let names: string[];
        try {
            names = readdirSync(dir);
        } catch {
            return;
        }
        for (const name of names) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else {
                files.push({
                    path: relative(contentDir, full).split(sep).join('/'),
                    source: readFileSync(full, 'utf8')
                });
            }
        }
    };
    walk(contentDir);
    return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** sha256 of every content file, path-sorted. */
function contentHashOf({ files }: { readonly files: readonly HelpContentFile[] }): string {
    const hash = createHash('sha256');
    const byPath = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    for (const file of byPath) {
        hash.update(`${file.path}\0${file.source.replace(/\r\n/g, '\n')}\0`);
    }
    return hash.digest('hex');
}

/** Sorted copy of a set-like array. */
function sorted<T extends string>(values: readonly T[]): T[] {
    return [...values].sort();
}

/** One parsed entry as the index stores it. */
function toIndexArticle({ entry }: { readonly entry: ParsedHelpEntry }): HelpArticle {
    const { frontmatter, body } = entry;
    return {
        id: frontmatter.id,
        locale: entry.locale,
        folder: entry.folder,
        title: frontmatter.title,
        summary: frontmatter.summary,
        audiences: sorted(frontmatter.audiences),
        verticals: sorted(frontmatter.verticals),
        keywords: frontmatter.keywords,
        destinations: frontmatter.destinations,
        ...(frontmatter.faqKey === undefined ? {} : { faqKey: frontmatter.faqKey }),
        public: frontmatter.public,
        related: frontmatter.related,
        covers: sorted(frontmatter.covers),
        entryFor: sorted(frontmatter.entryFor),
        reviewedAt: frontmatter.reviewedAt,
        translation: frontmatter.translation ?? null,
        sections: {
            ...body.sections,
            howTo: { steps: [...body.sections.howTo.steps], after: body.sections.howTo.after }
        }
    };
}

/** Where a content path says the article lives, or why the path is wrong. */
function locate({ path }: { readonly path: string }) {
    const [locale, folder, name, ...rest] = path.split('/');
    const knownLocale = HELP_LOCALES.find((value) => value === locale);
    const knownFolder = HELP_FOLDERS.find((value) => value === folder);
    if (
        knownLocale === undefined ||
        knownFolder === undefined ||
        name === undefined ||
        rest.length > 0 ||
        !name.endsWith('.md')
    ) {
        return `not a content path: expected <${HELP_LOCALES.join('|')}>/<${HELP_FOLDERS.join('|')}>/<id>.md`;
    }
    return { locale: knownLocale, folder: knownFolder, fileId: name.slice(0, -'.md'.length) };
}

/**
 * Parses, validates and serializes the catalog.
 *
 * @param args.files - The content files (see {@link readHelpContentFiles})
 * @returns The index and its JSON when every file parsed, and every issue
 *
 * @example
 * ```ts
 * const { json, issues } = buildHelpIndex({ files: readHelpContentFiles() });
 * ```
 */
export function buildHelpIndex({
    files
}: {
    readonly files: readonly HelpContentFile[];
}): BuildHelpIndexResult {
    const issues: HelpCatalogIssue[] = [];
    const entries: ParsedHelpEntry[] = [];
    for (const file of files) {
        const where = locate({ path: file.path });
        if (typeof where === 'string') {
            issues.push(helpIssue({ predicate: 'a1', file: file.path, detail: where }));
            continue;
        }
        const parsed = parseHelpArticle({ source: file.source, locale: where.locale });
        if (!parsed.ok) {
            for (const detail of parsed.errors) {
                issues.push(
                    helpIssue({ predicate: 'a1', file: file.path, articleId: where.fileId, detail })
                );
            }
            continue;
        }
        entries.push({
            file: file.path,
            ...where,
            frontmatter: parsed.frontmatter,
            body: parsed.body
        });
    }
    issues.push(...validateHelpCatalog({ entries }));
    if (entries.length !== files.length) {
        return { issues, fileCount: files.length };
    }

    const localeArticles = (locale: (typeof HELP_LOCALES)[number]) =>
        entries
            .filter((entry) => entry.locale === locale)
            .map((entry) => toIndexArticle({ entry }))
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const en = localeArticles('en');
    const pt = localeArticles('pt');
    const index: HelpIndex = {
        version: HELP_INDEX_VERSION,
        contentHash: contentHashOf({ files }),
        locales: {
            es: localeArticles('es'),
            ...(en.length > 0 ? { en } : {}),
            ...(pt.length > 0 ? { pt } : {})
        }
    };
    return { index, json: toCanonicalJson({ value: index }), issues, fileCount: files.length };
}
