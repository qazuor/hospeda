// global.d.ts

import type { createMockServiceLogger } from './setupTest';

declare global {
    var mockServiceLogger: ReturnType<typeof createMockServiceLogger>;
}
