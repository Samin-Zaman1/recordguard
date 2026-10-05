// The two roles allowed in our system
// A union type: anything else is a compile error
export type Role = "admin" | "customer";

// The CLEAN shape. Only validated data should ever have this type
export interface User {
  id: number;
  email: string;
  role: Role;
}

// Result of loading users: good records AND the rejected ones
// Returning rejects (not hiding them) lets callers and tests see what went wrong
export interface LoadResult {
  valid: User[];
  invalid: unknown[]; // unknown because we couldn't trust their shape
}