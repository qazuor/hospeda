/**
 * Shared assertions helpers for the generator tests.
 *
 * @module test/fixtures/build-helpers
 */

import { buildHelpIndex, type HelpContentFile } from '../../src/generator/build-index';
import type { HelpCatalogPredicate } from '../../src/generator/issues';

/** The predicates of a build, deduplicated. */
export const predicatesOf = (files: readonly HelpContentFile[]): HelpCatalogPredicate[] => [
    ...new Set(buildHelpIndex({ files }).issues.map((issue) => issue.predicate))
];

/** The details of a build's issues, as `<predicate> <detail>`. */
export const detailsOf = (files: readonly HelpContentFile[]): string[] =>
    buildHelpIndex({ files }).issues.map((issue) => `${issue.predicate} ${issue.detail}`);
