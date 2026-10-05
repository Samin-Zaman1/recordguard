import type { User } from "./types";
import { isValidEmail } from "./utils";

// unknown in, "value is User" out (type guard)
// true means TypeScript can treat the value as a User
export function isUser(value: unknown): value is User {
  // Check 1: must be a real object (typeof null is "object", so exclude it)
  if (typeof value !== "object" || value === null) return false;

  // We can't read fields from "unknown" or "object" safely.
  // This cast says "treat it as a bag of unknown values"
  // It's safe because we validate every field below
  const record = value as Record<string, unknown>;

  // Check 2: id must be a whole number
  if (!Number.isInteger(record.id)) return false;

  // Check 3: email must pass our earlier validator
  if (!isValidEmail(record.email)) return false;

  // Check 4: role must be exactly one of the allowed values
  if (record.role !== "admin" && record.role !== "customer") return false;

  // Every check passed
  return true;
}