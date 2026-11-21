/**
 * @file index.ts
 * @description The help generator (HOS-2410 spec §5.2). Dev-only: it reads the
 * file system and imports `yaml` and `marked`, so the package runtime
 * (`src/index.ts`) never imports this folder (AC-12). `pnpm help:build` and
 * guard (a) (`scripts/check-help-catalog.ts`) use it.
 */

export * from './build-index';
export * from './canonical-json';
export * from './format-issues';
export * from './issues';
export * from './parse-article';
export * from './validate-catalog';
