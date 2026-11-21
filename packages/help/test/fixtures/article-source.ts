/**
 * Builds synthetic article files for the generator tests, so each test starts
 * from a green catalog and changes ONE thing.
 *
 * @module test/fixtures/article-source
 */

import type { HelpContentFile } from '../../src/generator/build-index';

/** What a synthetic article may override. */
export interface ArticleOptions {
    readonly id: string;
    readonly folder?: string;
    readonly locale?: string;
    readonly frontmatter?: Readonly<Record<string, unknown>>;
    readonly omit?: readonly string[];
    readonly canDo?: string;
    readonly steps?: readonly string[];
    readonly after?: string;
    readonly expect?: string;
    readonly notExpect?: string;
    readonly troubleshooting?: string;
    /** Replaces the whole body. */
    readonly body?: string;
}

/** YAML for one frontmatter value (JSON is valid YAML). */
function yamlLine(key: string, value: unknown): string {
    return `${key}: ${JSON.stringify(value)}`;
}

/**
 * One synthetic article file. By default it is valid in a catalog of `a`, `b`
 * and `c` (see {@link greenCatalog}): host audience, links its own page, and
 * points at the other two.
 */
export function articleFile(options: ArticleOptions): HelpContentFile {
    const others = ['a', 'b', 'c'].filter((id) => id !== options.id);
    const frontmatter: Record<string, unknown> = {
        id: options.id,
        title: `Título ${options.id}`,
        summary: `Resumen ${options.id}.`,
        audiences: ['host'],
        verticals: ['accommodation'],
        keywords: [`clave${options.id}`],
        destinations: [{ kind: 'subscription' }],
        public: false,
        related: others.slice(0, 2),
        covers: ['page:mi-cuenta/suscripcion'],
        entryFor: [],
        reviewedAt: '2026-11-17',
        ...options.frontmatter
    };
    for (const key of options.omit ?? []) {
        delete frontmatter[key];
    }
    const yaml = Object.entries(frontmatter)
        .map(([key, value]) => yamlLine(key, value))
        .join('\n');
    const steps = options.steps ?? ['Primer paso.', 'Segundo paso.'];
    const body =
        options.body ??
        [
            '## Qué podés hacer',
            '',
            options.canDo ??
                `Ir a {{link:subscription}} y leer {{article:${others[0]}:como-se-hace|el otro}}.`,
            '',
            '## Cómo se hace',
            '',
            ...steps.map((step, index) => `${index + 1}. ${step}`),
            ...(options.after === undefined ? [] : ['', options.after]),
            '',
            '## Qué esperar',
            '',
            options.expect ?? 'Que funcione.',
            '',
            '## Qué NO esperar',
            '',
            options.notExpect ?? 'Magia.',
            '',
            '## Problemas comunes',
            '',
            options.troubleshooting ?? '### Algo falla {#algo-falla}\n\nReintentá.',
            ''
        ].join('\n');
    return {
        path: `${options.locale ?? 'es'}/${options.folder ?? 'host'}/${options.id}.md`,
        source: `---\n${yaml}\n---\n\n${body}`
    };
}

/** A clean three-article catalog. Pass overrides per id. */
export function greenCatalog(
    overrides: Readonly<Partial<Record<'a' | 'b' | 'c', Partial<ArticleOptions>>>> = {}
): HelpContentFile[] {
    return (['a', 'b', 'c'] as const).map((id) => articleFile({ id, ...overrides[id] }));
}
