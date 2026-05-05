/**
 * TypeScript declaration for CSS Module files.
 *
 * Allows importing *.module.css files as objects whose keys are the
 * local CSS class names and whose values are the scoped generated class
 * name strings at runtime.
 */
declare module '*.module.css' {
    const classes: Readonly<Record<string, string>>;
    export default classes;
}

/**
 * TypeScript declaration for plain CSS files (e.g. tokens.css).
 *
 * Side-effect imports like `import '../styles/tokens.css'` are valid;
 * they produce no JS export but they register the stylesheet.
 */
declare module '*.css' {
    const content: undefined;
    export default content;
}
