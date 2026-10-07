import { test, expect } from "@playwright/test";

test("can add a todo item", async ({ page }) => {
  // "page" is a fresh browser tab, provided by Playwright for each test

  // open a public demo app built for practice
  await page.goto("https://demo.playwright.dev/todomvc");

  // find the input by its placeholder text and type into it
  await page.getByPlaceholder("What needs to be done?").fill("Learn Playwright");

  // press Enter to submit
  await page.getByPlaceholder("What needs to be done?").press("Enter");

  // assert: the new item is shown in the list
  // toHaveText auto-retries until it matches or times out, so no manual waits
  await expect(page.getByTestId("todo-title")).toHaveText("Learn Playwright");
});