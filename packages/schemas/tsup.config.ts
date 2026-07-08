import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/feedback.server.ts'],
    format: ['esm', 'cjs'],
    // DTS generation is the memory/time hog of the deploy build (this package's
    // index.d.ts is ~4.7 MB and takes ~47s). The API/admin bundles resolve
    // @repo/* from source via tsconfig paths and never read these .d.ts files,
    // so the Dockerfiles set SKIP_PACKAGE_DTS=true to skip it. Unset (dev, CI,
    // typecheck) keeps DTS on so library consumers still get types.
    dts: process.env.SKIP_PACKAGE_DTS !== 'true'
});
