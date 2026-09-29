import { defineConfig } from "vitest/config";

// Day buckets and late-night checks follow the local zone; tests are written for UTC. Set here, not
// in the npm script, so it works on Windows too.
process.env.TZ = "UTC";

export default defineConfig({
  // The real-model test downloads the model: `npm run test:model` (vitest.model.config.ts).
  test: { exclude: ["**/node_modules/**", "**/dist/**", "test/model.test.ts"] },
});
