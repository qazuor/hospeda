/**
 * Nesting guard for `Section` (HOS-2413 T-005, D5 «nunca una caja dentro de otra»).
 *
 * `Section` provides `true` to its children. A `Section` that reads `true`
 * knows it is nested inside another one, which the kit refuses.
 *
 * @module components/account/ui/section-depth-context
 */

import { createContext } from 'react';

/** `true` inside a `Section` body. */
export const SectionDepthContext = createContext<boolean>(false);

/**
 * Thrown when a `Section` is rendered inside another `Section` in development
 * or tests. In production it logs and renders the children without the box
 * instead of crashing the page.
 */
export class KitNestingError extends Error {
    /** Creates the error with the kit's standard message. */
    constructor() {
        super(
            'Section cannot be nested inside another Section (D5: never a box inside a box). ' +
                'Use a heading, a divider or a list inside the body instead.'
        );
        this.name = 'KitNestingError';
    }
}
