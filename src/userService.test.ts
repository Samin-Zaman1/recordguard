import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { UserService } from "./userService.js";

// test data: two good users and two bad records
const admin = { id: 1, email: "a@x.com", role: "admin" };
const customer = { id: 2, email: "b@x.com", role: "customer" };
const badEmail = { id: 3, email: "nope", role: "admin" };
const badRole = { id: 4, email: "d@x.com", role: "manager" };

describe("UserService", () => {
  // the fake fetch function; recreated before every test
  // typed with the same signature UserService expects
  let fetchUsers: Mock<() => Promise<unknown[]>>;

  beforeEach(() => {
    fetchUsers = vi.fn<() => Promise<unknown[]>>();
  });

  it("returns valid users and separates invalid ones", async () => {
    fetchUsers.mockResolvedValue([admin, customer, badEmail, badRole]);
    const service = new UserService(fetchUsers, 3, 1); // 1ms delay = fast

    const result = await service.loadUsers();

    expect(result.valid).toEqual([admin, customer]);
    expect(result.invalid).toEqual([badEmail, badRole]);
  });

  it("retries when the fetch fails, then succeeds", async () => {
    fetchUsers
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce([admin]);
    const service = new UserService(fetchUsers, 3, 1);

    const result = await service.loadUsers();

    expect(result.valid).toEqual([admin]);
    expect(fetchUsers).toHaveBeenCalledTimes(2); // 1 failure + 1 success
  });

  it("throws if every attempt fails", async () => {
    fetchUsers.mockRejectedValue(new Error("server down"));
    const service = new UserService(fetchUsers, 3, 1);

    await expect(service.loadUsers()).rejects.toThrow("server down");
    expect(fetchUsers).toHaveBeenCalledTimes(3);
  });

  it("handles an empty response", async () => {
    fetchUsers.mockResolvedValue([]);
    const service = new UserService(fetchUsers, 3, 1);

    expect(await service.loadUsers()).toEqual({ valid: [], invalid: [] });
  });

  it("groups users by role", () => {
    const service = new UserService(fetchUsers);

    const groups = service.groupByRole([
      admin as never, // "as never" skips the strict Role check in test data
      customer as never,
    ]);

    expect(groups.admin).toHaveLength(1);
    expect(groups.customer).toHaveLength(1);
  });
});