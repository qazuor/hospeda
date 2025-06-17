import { describe, expect, it } from 'vitest';
import { DbError, throwDbError } from '../../src/utils/error';

describe('DbError', () => {
    it('should create an instance with correct properties', () => {
        const err = new DbError('User', 'find', { id: 1 }, 'Not found');
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(DbError);
        expect(err.entity).toBe('User');
        expect(err.method).toBe('find');
        expect(err.params).toEqual({ id: 1 });
        expect(err.message).toBe('Not found');
        expect(err.name).toBe('DbError');
    });

    it('should allow empty message', () => {
        const err = new DbError('User', 'find', { id: 1 }, '');
        expect(err.message).toBe('');
    });

    it('should allow undefined params', () => {
        const err = new DbError('User', 'find', undefined, 'fail');
        expect(err.params).toBeUndefined();
    });

    it('should allow empty entity and method', () => {
        const err = new DbError('', '', {}, 'fail');
        expect(err.entity).toBe('');
        expect(err.method).toBe('');
    });
});

describe('throwDbError', () => {
    it('should throw a DbError with correct properties', () => {
        try {
            throwDbError('User', 'find', { id: 2 }, 'No user');
        } catch (err) {
            expect(err).toBeInstanceOf(DbError);
            expect((err as DbError).entity).toBe('User');
            expect((err as DbError).method).toBe('find');
            expect((err as DbError).params).toEqual({ id: 2 });
            expect((err as DbError).message).toBe('No user');
        }
    });

    it('should propagate the thrown error', () => {
        expect(() => throwDbError('X', 'Y', undefined, 'fail')).toThrow(DbError);
    });
});
