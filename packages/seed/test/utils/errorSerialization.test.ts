import { describe, expect, it } from 'vitest';
import { describeError, toError } from '../../src/utils/errorSerialization.js';

describe('describeError', () => {
    it('describes a normal Error with its message and stack', () => {
        // Arrange
        const error = new Error('Something went wrong');

        // Act
        const described = describeError(error);

        // Assert
        expect(described.message).toBe('Something went wrong');
        expect(described.stack).toEqual(expect.stringContaining('Error: Something went wrong'));
        expect(described.cause).toBeUndefined();
    });

    it('serializes a plain object thrown as an error instead of producing [object Object]', () => {
        // Arrange
        const err = { code: 23505, detail: 'duplicate key' };

        // Act
        const described = describeError(err);

        // Assert: this is the regression case for HOS-922 — a non-Error thrown value must
        // never collapse to the literal string "[object Object]".
        expect(described.message).not.toContain('[object Object]');
        expect(described.message).toContain('23505');
        expect(described.message).toContain('duplicate key');
        expect(JSON.parse(described.message)).toEqual(err);
    });

    it('serializes the message when an Error instance carries a non-string .message', () => {
        // Arrange: the exact shape that produced the original HOS-922 bug report — the
        // caught value passes `instanceof Error`, so a naive `(err as Error).message` cast
        // type-checks and looks safe, but `.message` itself is not a string.
        const error = new Error('placeholder');
        (error as unknown as { message: unknown }).message = {
            reason: 'constraint violation',
            code: 'P2002'
        };

        // Act
        const described = describeError(error);

        // Assert
        expect(described.message).not.toBe('[object Object]');
        expect(described.message).toContain('constraint violation');
        expect(described.message).toContain('P2002');
    });

    it('returns a plain string thrown directly', () => {
        // Act
        const described = describeError('boom');

        // Assert
        expect(described.message).toBe('boom');
    });

    it('describes a thrown null explicitly, never the bare word "undefined"', () => {
        // Act
        const described = describeError(null);

        // Assert
        expect(described.message).toBe('[null thrown]');
        expect(described.message).not.toBe('undefined');
    });

    it('describes a thrown undefined explicitly, never the bare word "undefined" alone', () => {
        // Act
        const described = describeError(undefined);

        // Assert
        expect(described.message).toBe('[undefined thrown]');
    });

    it('does not throw on an object with a circular reference', () => {
        // Arrange
        const circular: Record<string, unknown> = { code: 'CIRCULAR' };
        circular.self = circular;

        // Act + Assert
        expect(() => describeError(circular)).not.toThrow();
        const described = describeError(circular);
        expect(described.message).toContain('CIRCULAR');
        expect(described.message).not.toContain('[object Object]');
    });

    it('describes error.cause when present, without interpolating it raw', () => {
        // Arrange
        const cause = { code: 'ECONNREFUSED' };
        const error = new Error('Query failed', { cause });

        // Act
        const described = describeError(error);

        // Assert
        expect(described.cause).toBeDefined();
        expect(described.cause).not.toBe('[object Object]');
        expect(described.cause).toContain('ECONNREFUSED');
    });

    it('describes a string error.cause as-is', () => {
        // Arrange
        const error = Object.assign(new Error('Failed'), { cause: 'root cause detail' });

        // Act
        const described = describeError(error);

        // Assert
        expect(described.cause).toBe('root cause detail');
    });

    it('describes an AggregateError, including its nested errors', () => {
        // Arrange
        const aggregate = new AggregateError(
            [new Error('first failure'), new Error('second failure')],
            'Multiple operations failed'
        );

        // Act
        const described = describeError(aggregate);

        // Assert
        expect(described.message).toContain('Multiple operations failed');
        expect(described.message).toContain('first failure');
        expect(described.message).toContain('second failure');
    });
});

describe('toError', () => {
    it('returns the same instance when the value is already an Error', () => {
        // Arrange
        const error = new Error('boom');

        // Act
        const result = toError(error);

        // Assert
        expect(result).toBe(error);
    });

    it('wraps a non-Error value in a real Error with a readable message', () => {
        // Arrange
        const err = { code: 23505, detail: 'duplicate key' };

        // Act
        const result = toError(err);

        // Assert
        expect(result).toBeInstanceOf(Error);
        expect(result.message).not.toContain('[object Object]');
        expect(result.message).toContain('duplicate key');
    });

    it('keeps the original value reachable through cause', () => {
        // Arrange
        const err = { code: 'BOOM' };

        // Act
        const result = toError(err);

        // Assert
        expect(result.cause).toBe(err);
    });

    it('wraps a thrown string in a real Error', () => {
        // Act
        const result = toError('plain string error');

        // Assert
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('plain string error');
    });
});
