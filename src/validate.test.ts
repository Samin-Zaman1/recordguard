import { describe, it, expect } from "vitest";
import { isUser } from "./validate";

describe("isUser", () => {
  it("accepts a valid user", () => {
    expect(isUser({ id: 1, email: "a@x.com", role: "admin" })).toBe(true);
  });

  // it.each runs the same test once per row in the table
  // %j prints the row as JSON in the test name
  it.each([
    [null],                                             // not an object
    ["text"],                                           // a string
    [{ email: "a@x.com", role: "admin" }],              // missing id
    [{ id: "1", email: "a@x.com", role: "admin" }],     // id is a string
    [{ id: 1.5, email: "a@x.com", role: "admin" }],     // id not whole
    [{ id: 1, email: "bad-email", role: "admin" }],     // invalid email
    [{ id: 1, email: "a@x.com", role: "manager" }],     // unknown role
  ])("rejects invalid input: %j", (input) => {
    expect(isUser(input)).toBe(false);
  });
});