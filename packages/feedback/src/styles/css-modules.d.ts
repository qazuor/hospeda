/**
 * TypeScript declaration for plain CSS files.
 *
 * Side-effect imports like `import './Button.css'` or `import '../styles/tokens.css'`
 * are valid; they produce no JS export but they register the stylesheet.
 */
declare module '*.css' {
    const content: undefined;
    export default content;
}
