/** The sections a run can report on. Order here is the order they render in. */
export const SECTION_IDS = [
    'code',
    'tests',
    'debt',
    'packages',
    'i18n',
    'git',
    'prs',
    'linear'
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export type SectionMeta = {
    readonly id: SectionId;
    readonly label: string;
    readonly hint: string;
    /** True when the section reaches the network. */
    readonly network: boolean;
    /** Rough wall-clock cost, shown in the menu so a slow pick is a deliberate one. */
    readonly cost: string;
};

export const SECTIONS: readonly SectionMeta[] = [
    { id: 'code', label: 'código', hint: 'LOC y archivos por bucket', network: false, cost: '<1s' },
    {
        id: 'tests',
        label: 'tests',
        hint: 'suites, casos por tipo, aserciones',
        network: false,
        cost: '<1s'
    },
    {
        id: 'debt',
        label: 'deuda',
        hint: 'TODO, ignores, any, archivos gordos',
        network: false,
        cost: '~7s'
    },
    {
        id: 'packages',
        label: 'paquetes',
        hint: 'LOC y cobertura declarativa por paquete',
        network: false,
        cost: '~2s'
    },
    {
        id: 'i18n',
        label: 'i18n',
        hint: 'namespaces, claves, faltantes y obsoletas',
        network: false,
        cost: '<1s'
    },
    {
        id: 'git',
        label: 'git',
        hint: 'commits, tipos, churn, migraciones',
        network: false,
        cost: '~1s'
    },
    {
        id: 'prs',
        label: 'prs',
        hint: 'mergeados, lead time, higiene, reverts',
        network: true,
        cost: '~25s'
    },
    {
        id: 'linear',
        label: 'linear',
        hint: 'estados, balance, prioridad, smoke',
        network: true,
        cost: '~5s'
    }
];

/**
 * Detailed reports are a separate view, not extra sections.
 *
 * A section answers "how are we"; a report answers "what do I pick up now", and
 * its output is a list of named rows. Mixing them means `--all` prints hundreds
 * of lines nobody asked for.
 */
export const REPORT_IDS = [
    'worktrees',
    'linear-stalled',
    'i18n-untranslated',
    'prs-open',
    'debt-detail'
] as const;

export type ReportId = (typeof REPORT_IDS)[number];

export const REPORTS: readonly {
    readonly id: ReportId;
    readonly label: string;
    readonly hint: string;
    readonly network: boolean;
    readonly cost: string;
}[] = [
    {
        id: 'worktrees',
        label: 'worktrees',
        hint: 'qué tiene cada uno y cuáles se pueden borrar',
        network: false,
        cost: '30-100s'
    },
    {
        id: 'linear-stalled',
        label: 'trabajo estancado',
        hint: 'en curso sin avanzar, smoke pendiente, urgentes',
        network: true,
        cost: '~5s'
    },
    {
        id: 'i18n-untranslated',
        label: 'traducciones falsas',
        hint: 'claves presentes pero con el texto en español',
        network: false,
        cost: '<1s'
    },
    {
        id: 'prs-open',
        label: 'PRs abiertos',
        hint: 'qué frena a cada uno: CI, conflicto o merge',
        network: true,
        cost: '~20s'
    },
    {
        id: 'debt-detail',
        label: 'deuda en detalle',
        hint: 'ignores por regla, archivos gordos, any',
        network: false,
        cost: '~2s'
    }
];

export type Period = '1w' | '1m' | '3m' | 'all';

export type PeriodSpec = {
    readonly id: Period;
    readonly label: string;
    /** ISO date the period starts at, or null for "all history". */
    readonly since: string | null;
};

/**
 * A section either produced data or explains why it could not.
 *
 * Modelling failure as a value rather than as a zero is the core lesson this
 * tool was built on: a parser that dies must never fall through to a default
 * that reads like a measurement.
 */
export type Outcome<T> = { ok: true; data: T } | { ok: false; reason: string };

export type LanguageBreakdown = {
    readonly language: string;
    readonly loc: number;
    readonly files: number;
};

export type CodeStats = {
    readonly trackedFiles: number;
    readonly srcLoc: number;
    readonly srcFiles: number;
    readonly testLoc: number;
    readonly testFiles: number;
    /** Source lines split by language, largest first. Sums to `srcLoc`. */
    readonly srcByLanguage: readonly LanguageBreakdown[];
    /** Test lines split by language, largest first. Sums to `testLoc`. */
    readonly testByLanguage: readonly LanguageBreakdown[];
    readonly jsonLoc: number;
    readonly jsonFiles: number;
    readonly mdLoc: number;
    readonly mdFiles: number;
    readonly sqlLoc: number;
    readonly sqlFiles: number;
    readonly filesOver500: number;
    readonly filesOver1000: number;
    readonly biggestFiles: readonly { readonly path: string; readonly loc: number }[];
};

export type TestKind = 'unit' | 'guard' | 'integration' | 'e2e';

/**
 * Where a test file lives relative to the project's own rule.
 *
 * The rule is that tests live in a `test/` directory beside `src/`. Agents
 * routinely drop them in `__tests__/` or next to the code instead, so those are
 * still counted — a misplaced test is a real test — but named for migration.
 */
export type TestLocation = 'policy' | '__tests__' | 'tests-plural' | 'beside-code' | 'exempt';

export type MisplacedTests = {
    readonly location: Exclude<TestLocation, 'policy' | 'exempt'>;
    readonly files: readonly string[];
};

export type TestStats = {
    readonly suites: number;
    readonly cases: number;
    readonly byKind: Readonly<Record<TestKind, { readonly cases: number; readonly files: number }>>;
    readonly assertions: number;
    readonly parameterised: number;
    readonly hardSkips: number;
    readonly conditionalSkips: number;
    readonly filesInPolicy: number;
    readonly filesExempt: number;
    readonly misplaced: readonly MisplacedTests[];
    readonly misplacedTotal: number;
};

export type NamespaceStats = {
    readonly namespace: string;
    /** Key count in the reference locale. */
    readonly keys: number;
    /** Keys present in the reference locale and absent in this one. */
    readonly missing: Readonly<Record<string, number>>;
    /** Keys present in this locale and absent from the reference — likely stale. */
    readonly extra: Readonly<Record<string, number>>;
};

export type I18nStats = {
    readonly reference: string;
    readonly locales: readonly string[];
    readonly namespaces: number;
    readonly totalKeys: number;
    readonly byNamespace: readonly NamespaceStats[];
    readonly missingByLocale: Readonly<Record<string, number>>;
    readonly extraByLocale: Readonly<Record<string, number>>;
    /** Namespaces present in some locale but not in the reference. */
    readonly orphanNamespaces: readonly string[];
};

/** One TODO/FIXME/HACK, located and dated, so it can actually be acted on. */
export type Annotation = {
    readonly kind: 'TODO' | 'FIXME' | 'HACK' | 'XXX';
    readonly path: string;
    readonly line: number;
    readonly text: string;
    /** Days since the line last changed, or -1 when git could not date it. */
    readonly ageDays: number;
};

/** Anything older than this is stale enough to be a decision nobody made. */
export const STALE_DAYS = 180;

export type DebtStats = {
    readonly annotations: Readonly<Record<string, number>>;
    readonly explicitAny: number;
    readonly anyTop: readonly { readonly path: string; readonly count: number }[];
    readonly todoOldestDays: number;
    readonly todoMedianDays: number;
    /** Every FIXME and HACK, and any TODO older than STALE_DAYS. Oldest first. */
    readonly stale: readonly Annotation[];
    readonly staleCount: number;
};

export type PackageStats = {
    readonly name: string;
    readonly srcLoc: number;
    readonly testLoc: number;
    readonly cases: number;
    readonly untested: number;
    readonly total: number;
};

/** The same counts over several windows, so a figure has something to sit against. */
export type Windowed = {
    readonly week: number;
    readonly month: number;
    readonly total: number;
};

export type GitStats = {
    readonly commits: Windowed;
    readonly authors: number;
    readonly migrations: Windowed;
    readonly specs: Windowed;
    readonly types: readonly { readonly type: string; readonly count: number }[];
    readonly churn: readonly { readonly path: string; readonly count: number }[];
};

/** A pull request that changed source without touching any test. */
export type UntestedPr = {
    /** PR number when the merge subject carries one, else null. */
    readonly number: number | null;
    /** The head branch the PR came from. */
    readonly from: string;
};

export type PrStats = {
    readonly merged: Windowed;
    readonly open: number;
    readonly leadMedianH: number;
    readonly leadP90H: number;
    readonly leadMaxH: number;
    readonly sizeMedian: number;
    readonly biggest: readonly {
        readonly number: number;
        readonly lines: number;
        readonly title: string;
    }[];
    readonly withTests: number;
    readonly withoutTests: number;
    readonly noCode: number;
    readonly untested: readonly UntestedPr[];
    readonly reverts: Windowed;
};

/** Per-team slice of the Linear numbers, so a combined total stays legible. */
export type TeamStats = {
    readonly team: string;
    readonly total: number;
    readonly open: number;
    readonly started: number;
    readonly smoke: number;
};

/** A count broken down by team, so a combined total never hides where it came from. */
export type Counted = {
    readonly name: string;
    readonly total: number;
    readonly byTeam: Readonly<Record<string, number>>;
};

/** The oldest issue still waiting on a manual smoke — named, not just counted. */
export type OldestSmoke = {
    readonly identifier: string;
    readonly title: string;
    readonly days: number;
    readonly labels: readonly string[];
};

export type LinearStats = {
    readonly teams: readonly TeamStats[];
    readonly total: number;
    readonly open: number;
    readonly started: number;
    readonly done: number;
    readonly createdInPeriod: number;
    readonly closedInPeriod: number;
    readonly byState: readonly Counted[];
    readonly byPriority: readonly Counted[];
    readonly byArea: readonly Counted[];
    readonly smokeTotal: number;
    readonly smokeByLabel: readonly Counted[];
    readonly smokeOldest: OldestSmoke | null;
    readonly balance: readonly {
        readonly week: string;
        readonly created: number;
        readonly closed: number;
        readonly createdByTeam: Readonly<Record<string, number>>;
        readonly closedByTeam: Readonly<Record<string, number>>;
    }[];
    readonly cycleMedianDays: number;
};

/**
 * What a worktree is for, decided from local git state alone.
 *
 * `merged` means it has no commits the integration branch lacks and nothing
 * uncommitted — the work landed and the directory is only holding disk.
 */
export type WorktreeState = 'merged' | 'uncommitted' | 'unmerged' | 'missing';

export type WorktreeInfo = {
    readonly name: string;
    readonly path: string;
    /** The primary clone. It can look 'merged' but must never be offered for deletion. */
    readonly isMain: boolean;
    readonly branch: string;
    readonly state: WorktreeState;
    readonly ahead: number;
    readonly dirty: number;
    readonly unpushed: number | null;
    readonly mb: number;
    readonly lastCommit: string;
};

export type RepoStats = {
    readonly worktrees: readonly WorktreeInfo[];
    readonly totalMb: number;
    readonly gitMb: number;
    /** Disk held by worktrees whose work already landed. */
    readonly reclaimableMb: number;
};

export type Report = {
    readonly repoName: string;
    readonly repoPath: string;
    readonly sha: string;
    readonly at: string;
    readonly period: PeriodSpec;
    readonly code?: Outcome<CodeStats>;
    readonly tests?: Outcome<TestStats>;
    readonly i18n?: Outcome<I18nStats>;
    readonly debt?: Outcome<DebtStats>;
    readonly packages?: Outcome<readonly PackageStats[]>;
    readonly git?: Outcome<GitStats>;
    readonly prs?: Outcome<PrStats>;
    readonly linear?: Outcome<LinearStats>;
    readonly repo?: Outcome<RepoStats>;
};
