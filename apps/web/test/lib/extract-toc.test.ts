/**
 * @file extract-toc.test.ts
 * @description Unit tests for the extractToc utility.
 */

import { describe, expect, it } from 'vitest';
import { extractToc } from '../../src/lib/extract-toc';

describe('extractToc', () => {
    it('returns empty array for empty string', () => {
        expect(extractToc({ html: '' })).toEqual([]);
    });

    it('extracts h2 with id', () => {
        const html = '<h2 id="intro">Introduction</h2>';
        expect(extractToc({ html })).toEqual([{ level: 2, text: 'Introduction', id: 'intro' }]);
    });

    it('extracts h3 with id', () => {
        const html = '<h3 id="sub-section">Sub Section</h3>';
        expect(extractToc({ html })).toEqual([
            { level: 3, text: 'Sub Section', id: 'sub-section' }
        ]);
    });

    it('extracts both h2 and h3 in document order', () => {
        const html = `
			<h2 id="section-one">Section One</h2>
			<p>Some content</p>
			<h3 id="subsection-a">Subsection A</h3>
			<h2 id="section-two">Section Two</h2>
		`;
        expect(extractToc({ html })).toEqual([
            { level: 2, text: 'Section One', id: 'section-one' },
            { level: 3, text: 'Subsection A', id: 'subsection-a' },
            { level: 2, text: 'Section Two', id: 'section-two' }
        ]);
    });

    it('ignores h1 headings', () => {
        const html = '<h1 id="title">Page Title</h1><h2 id="intro">Intro</h2>';
        expect(extractToc({ html })).toEqual([{ level: 2, text: 'Intro', id: 'intro' }]);
    });

    it('ignores h4, h5, h6 headings', () => {
        const html = `
			<h4 id="deep">Deep</h4>
			<h5 id="deeper">Deeper</h5>
			<h6 id="deepest">Deepest</h6>
			<h2 id="valid">Valid</h2>
		`;
        expect(extractToc({ html })).toEqual([{ level: 2, text: 'Valid', id: 'valid' }]);
    });

    it('ignores headings without id attribute', () => {
        const html = '<h2>No ID heading</h2><h2 id="has-id">Has ID</h2>';
        expect(extractToc({ html })).toEqual([{ level: 2, text: 'Has ID', id: 'has-id' }]);
    });

    it('strips inner HTML tags from heading text', () => {
        const html = '<h2 id="styled"><strong>Bold</strong> heading with <em>emphasis</em></h2>';
        expect(extractToc({ html })).toEqual([
            { level: 2, text: 'Bold heading with emphasis', id: 'styled' }
        ]);
    });

    it('decodes HTML entities in heading text', () => {
        const html = '<h2 id="entities">Tom &amp; Jerry &lt;classic&gt;</h2>';
        expect(extractToc({ html })).toEqual([
            { level: 2, text: 'Tom & Jerry <classic>', id: 'entities' }
        ]);
    });

    it('decodes &nbsp; entity', () => {
        const html = '<h2 id="nbps-test">Hello&nbsp;World</h2>';
        const result = extractToc({ html });
        expect(result[0]?.text).toBe('Hello World');
    });

    it('handles id attribute after other attributes', () => {
        const html = '<h2 class="section-title" id="my-section">My Section</h2>';
        expect(extractToc({ html })).toEqual([{ level: 2, text: 'My Section', id: 'my-section' }]);
    });

    it('handles id attribute before other attributes', () => {
        const html = '<h2 id="my-section" class="section-title">My Section</h2>';
        expect(extractToc({ html })).toEqual([{ level: 2, text: 'My Section', id: 'my-section' }]);
    });

    it('returns empty array for HTML without headings', () => {
        const html = '<p>Just a paragraph</p><div>And a div</div>';
        expect(extractToc({ html })).toEqual([]);
    });

    it('handles multiline heading content by trimming outer whitespace', () => {
        const html = '<h2 id="multi">\n  Heading Content\n</h2>';
        const result = extractToc({ html });
        expect(result[0]?.text).toBe('Heading Content');
        expect(result[0]?.id).toBe('multi');
    });

    it('preserves order of mixed h2 and h3', () => {
        const html = `
			<h3 id="first-sub">First Sub</h3>
			<h2 id="first-main">First Main</h2>
			<h3 id="second-sub">Second Sub</h3>
		`;
        const result = extractToc({ html });
        expect(result).toHaveLength(3);
        expect(result[0]?.id).toBe('first-sub');
        expect(result[1]?.id).toBe('first-main');
        expect(result[2]?.id).toBe('second-sub');
    });
});
