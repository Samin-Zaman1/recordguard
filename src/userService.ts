import type { LoadResult, User } from "./types";
import { groupBy, retry } from "./utils";
import { isUser } from "./validate";

export class UserService {
  // "private readonly" in the constructor creates a property AND assigns it
  // fetchUsers: a function that returns a Promise of raw (untrusted) records
  // attempts / delayMs: retry settings, with defaults
  constructor(
    private readonly fetchUsers: () => Promise<unknown[]>,
    private readonly attempts = 3,
    private readonly delayMs = 100
  ) {}

  async loadUsers(): Promise<LoadResult> {
    // retry calls fetchUsers up to "attempts" times
    // if all fail, it throws the last error and loadUsers fails too
    const raw = await retry(this.fetchUsers, this.attempts, this.delayMs);

    // start with two empty buckets
    const valid: User[] = [];
    const invalid: unknown[] = [];

    for (const record of raw) {
      // isUser is a type guard: inside this if, "record" is a User
      if (isUser(record)) {
        valid.push(record);
      } else {
        invalid.push(record); // keep the bad record so callers can see it
      }
    }

    return { valid, invalid };
  }

  // reuses groupBy from utils; "role" must be a real key of User
  groupByRole(users: User[]): Record<string, User[]> {
    return groupBy(users, "role");
  }
}