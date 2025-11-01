/**
 * Sample TypeScript file with various comment patterns
 */

// TODO: Simple todo comment
export function simpleFunction() {
    return 'test';
}

// TODO(high): High priority todo
export function highPriorityFunction() {
    return 'high priority';
}

// TODO(@username): Assigned todo
export function assignedFunction() {
    return 'assigned';
}

// TODO[refactor]: Labeled todo
export function labeledFunction() {
    return 'labeled';
}

// TODO(P1)[@security]: Combined metadata
export function combinedMetadata() {
    return 'combined';
}

// HACK: Temporary workaround for API issue
export function hackFunction() {
    return 'hack';
}

// DEBUG: Remove before production
export function debugFunction() {
    console.log('debug info');
}

/*
 * TODO: Multi-line todo comment
 * with additional context
 * and more details
 */
export function multiLineFunction() {
    return 'multi-line';
}

export class SampleClass {
    // TODO: Add validation
    validate() {
        return true;
    }

    /* HACK: Quick fix for edge case */
    quickFix() {
        return 'fixed';
    }
}

// This is a TODO in a string, should be ignored in content: "TODO: not a real todo"
const stringWithTodo = "TODO: this is in a string";

// Multiple TODOs on same line: TODO: first TODO(high): second
export function multipleTodos() {
    return 'multiple';
}

// TODO(medium)[performance](@john): Complex metadata
export function complexMetadata() {
    return 'complex';
}

// Edge case: TODO without colon should still work
export function noColon() {
    return 'no colon';
}

// TODO(): Empty priority
export function emptyPriority() {
    return 'empty';
}

// TODO[]: Empty label
export function emptyLabel() {
    return 'empty label';
}
