// Run with: npm run example
//
// Loads users from a flaky "API" that fails twice before answering, and whose
// answer contains some bad records. RecordGuard retries the load, keeps the
// good users, and reports exactly what was wrong with the rest.

import { z } from "zod";
import { loadAndGuard } from "../src/index.js";

const User = z.object({
  id: z.number().int(),
  email: z.email(),
  role: z.enum(["admin", "customer"]),
});

let calls = 0;
async function fetchUsers(): Promise<unknown> {
  calls++;
  if (calls < 3) throw new Error(`503 Service Unavailable (attempt ${calls})`);
  return [
    { id: 1, email: "ada@example.com", role: "admin" },
    { id: 2, email: "not-an-email", role: "customer" },
    { id: 3, email: "grace@example.com", role: "customer" },
    { id: 4.5, email: "alan@example.com", role: "superuser" },
  ];
}

const { valid, invalid } = await loadAndGuard({
  load: fetchUsers,
  validate: User,
  attempts: 3,
  delayMs: 200,
  shouldRetry: (_error, attempt) => {
    console.log(`Load failed on attempt ${attempt}, retrying...`);
    return true;
  },
});

console.log(`\nLoaded after ${calls} attempts: ${valid.length} valid, ${invalid.length} rejected\n`);
for (const user of valid) console.log(`  ok        #${user.id} ${user.email} (${user.role})`);
for (const { index, issues } of invalid) {
  const reasons = issues.map((i) => `${i.path?.join(".") ?? "record"}: ${i.message}`).join("; ");
  console.log(`  rejected  record ${index}: ${reasons}`);
}
