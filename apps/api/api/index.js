// Vercel Serverless Function entry point.
// Re-exports the ESM Hono handler from dist/. The file extension is
// `.js` (not .cjs) because Vercel only auto-detects standard extensions
// as Serverless Functions; package.json `"type": "module"` makes this
// file ESM. tsup is configured with format: ['esm', 'cjs'], emitting
// dist/vercel.js (ESM) and dist/vercel.cjs (CJS); import the ESM one.
import handler from '../dist/vercel.js';

export default handler;
