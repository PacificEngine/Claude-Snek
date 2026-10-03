import { defineConfig } from 'vitest/config';

// The seeded placement and enemy-movement tests run thousands of route checks (up to ~4 s alone on the
// 50x50 Frantic fixture), so they time out at the default 5 s when the whole suite runs in parallel.
export default defineConfig({ test: { testTimeout: 30_000 } });
