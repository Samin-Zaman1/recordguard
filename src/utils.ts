// ---------- sleep ----------

// ms = milliseconds to wait
// Promise<void> = finishes later, returns no value
export function sleep(ms: number): Promise<void> {
  // "resolve" is a function; calling it marks the Promise as finished
  // setTimeout calls resolve after ms milliseconds
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- isValidEmail ----------

// unknown = accept ANY input (number, null, object...)
// "value is string" = type guard: true means "this is a string"
export function isValidEmail(value: unknown): value is string {
  // Step 1: not a string? Stop here. We can't use string tools on it yet
  if (typeof value !== "string") return false;

  // Step 2: regex pattern
  // ^         start of text
  // [^\s@]+   1+ characters that are not whitespace or @  (name part)
  // @         a literal @
  // [^\s@]+   1+ characters (domain part)
  // \.        a literal dot
  // [^\s@]+   1+ characters (like "com")
  // $         end of text
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // .test() returns true if the whole string matches
  return pattern.test(value);
}

// ---------- groupBy ----------

// <T>                 = items can be any type (users, orders, etc.)
// items: T[]          = the array to group
// key: keyof T        = must be a REAL property name of T (typos become errors)
// Record<string, T[]> = returns an object: bucket name -> array of items
export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  // empty object we will fill; "as" tells TypeScript its final shape
  const result = {} as Record<string, T[]>;

  // loop through every item once
  for (const item of items) {
    // read the value at the key, convert to string (object keys are strings)
    // e.g. item.role = "admin" -> bucket = "admin"
    const bucket = String(item[key]);

    // ??= means: if result[bucket] is undefined, set it to []
    // so the first item of each group creates the bucket
    result[bucket] ??= [];

    // add the item to its bucket
    result[bucket].push(item);
  }

  // return the finished groups
  return result;
}

// ---------- retry ----------

// <T>                  = whatever type fn eventually returns
// fn: () => Promise<T> = a function with no params that returns a Promise
// attempts             = max number of tries
// delayMs = 100        = default value; callers can leave it out
export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs = 100
): Promise<T> {
  // fail early: retrying 0 times makes no sense
  if (attempts < 1) throw new Error("attempts must be at least 1");

  // stores the most recent failure; unknown because JS can throw anything
  let lastError: unknown;

  // i goes 1, 2, 3 ... up to attempts
  for (let i = 1; i <= attempts; i++) {
    try {
      // await is essential: without it, a rejected promise escapes the
      // try/catch and we never retry
      // return exits the whole function on the first success
      return await fn();
    } catch (err) {
      // it failed: remember why
      lastError = err;

      // only wait if another attempt is coming
      if (i < attempts) await sleep(delayMs);
    }
  }

  // reaching here means every attempt failed; throw the last error
  throw lastError;
}

// ---------- unique ----------

// removes duplicates from an array
// Set only keeps unique values; [...] spreads it back into an array
export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}