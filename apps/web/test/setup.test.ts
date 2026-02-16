import { describe, expect, it } from 'vitest';

/**
 * Infrastructure Canary Tests
 *
 * These tests verify that the Vitest testing infrastructure is properly
 * configured and working. They test the test runner itself, not application code.
 */
describe('Vitest Infrastructure', () => {
    describe('Globals', () => {
        it('should have access to describe function', () => {
            expect(describe).toBeDefined();
            expect(typeof describe).toBe('function');
        });

        it('should have access to it function', () => {
            expect(it).toBeDefined();
            expect(typeof it).toBe('function');
        });

        it('should have access to expect function', () => {
            expect(expect).toBeDefined();
            expect(typeof expect).toBe('function');
        });
    });

    describe('Jest-DOM matchers', () => {
        it('should have toBeInTheDocument matcher', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);
            expect(element).toBeInTheDocument();
            document.body.removeChild(element);
        });

        it('should have toBeVisible matcher', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);
            expect(element).toBeVisible();
            document.body.removeChild(element);
        });

        it('should have toHaveClass matcher', () => {
            const element = document.createElement('div');
            element.className = 'test-class';
            expect(element).toHaveClass('test-class');
        });

        it('should have toHaveTextContent matcher', () => {
            const element = document.createElement('div');
            element.textContent = 'Hello World';
            expect(element).toHaveTextContent('Hello World');
        });

        it('should have toHaveAttribute matcher', () => {
            const element = document.createElement('div');
            element.setAttribute('data-testid', 'test');
            expect(element).toHaveAttribute('data-testid', 'test');
        });
    });

    describe('jsdom environment', () => {
        it('should have document object', () => {
            expect(document).toBeDefined();
            expect(document.createElement).toBeDefined();
        });

        it('should have window object', () => {
            expect(window).toBeDefined();
            expect(window.document).toBe(document);
        });

        it('should have navigator object', () => {
            expect(navigator).toBeDefined();
            expect(navigator.userAgent).toBeDefined();
        });

        it('should have localStorage', () => {
            expect(localStorage).toBeDefined();
            expect(typeof localStorage.getItem).toBe('function');
            expect(typeof localStorage.setItem).toBe('function');
        });

        it('should have sessionStorage', () => {
            expect(sessionStorage).toBeDefined();
            expect(typeof sessionStorage.getItem).toBe('function');
            expect(typeof sessionStorage.setItem).toBe('function');
        });

        it('should allow DOM manipulation', () => {
            const div = document.createElement('div');
            div.id = 'test-element';
            div.textContent = 'Test content';

            document.body.appendChild(div);

            const found = document.getElementById('test-element');
            expect(found).toBeDefined();
            expect(found?.textContent).toBe('Test content');

            document.body.removeChild(div);
            expect(document.getElementById('test-element')).toBeNull();
        });

        it('should support event listeners', () => {
            const button = document.createElement('button');
            let clicked = false;

            button.addEventListener('click', () => {
                clicked = true;
            });

            button.click();
            expect(clicked).toBe(true);
        });

        it('should support CSS selectors', () => {
            const parent = document.createElement('div');
            parent.className = 'parent';

            const child = document.createElement('span');
            child.className = 'child';
            child.textContent = 'Child text';

            parent.appendChild(child);
            document.body.appendChild(parent);

            const found = document.querySelector('.parent .child');
            expect(found).toBeDefined();
            expect(found?.textContent).toBe('Child text');

            document.body.removeChild(parent);
        });
    });

    describe('Vitest matchers', () => {
        it('should support basic equality matchers', () => {
            expect(1 + 1).toBe(2);
            expect([1, 2, 3]).toEqual([1, 2, 3]);
            expect({ a: 1 }).toEqual({ a: 1 });
        });

        it('should support truthiness matchers', () => {
            expect(true).toBeTruthy();
            expect(false).toBeFalsy();
            expect(null).toBeNull();
            expect(undefined).toBeUndefined();
            expect('value').toBeDefined();
        });

        it('should support array matchers', () => {
            expect([1, 2, 3]).toContain(2);
            expect([1, 2, 3]).toHaveLength(3);
        });

        it('should support string matchers', () => {
            expect('hello world').toContain('world');
            expect('test@example.com').toMatch(/@/);
        });

        it('should support object matchers', () => {
            expect({ a: 1, b: 2 }).toHaveProperty('a');
            expect({ a: 1, b: 2 }).toHaveProperty('a', 1);
        });

        it('should support async matchers', async () => {
            const promise = Promise.resolve('success');
            await expect(promise).resolves.toBe('success');
        });
    });
});
