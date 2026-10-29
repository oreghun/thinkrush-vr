// Fails the build when dist/ grows past the project's 20 MB budget.
// Runs after every build. Run: node scripts/check-build-size.mjs
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_BYTES = 20 * 1024 * 1024;
const dist = fileURLToPath(new URL('../dist', import.meta.url));

function sizeOf(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce(
    (total, entry) => {
      const path = join(directory, entry.name);
      return total + (entry.isDirectory() ? sizeOf(path) : statSync(path).size);
    },
    0,
  );
}

const megabytes = (bytes) => (bytes / 1024 / 1024).toFixed(1);
const total = sizeOf(dist);
if (total > BUDGET_BYTES) {
  console.error(
    `Build is ${megabytes(total)} MB, over the ${megabytes(BUDGET_BYTES)} MB budget.`,
  );
  process.exit(1);
}
console.log(
  `Build size: ${megabytes(total)} MB of ${megabytes(BUDGET_BYTES)} MB budget.`,
);
