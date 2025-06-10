// global.d.ts

import type { createMockDb, createMockDbLogger, createMockServiceLogger } from './setupTest';

declare global {
    var mockDb: ReturnType<typeof createMockDb>;
    var mockDbLogger: ReturnType<typeof createMockDbLogger>;
    var mockServiceLogger: ReturnType<typeof createMockServiceLogger>;
}
