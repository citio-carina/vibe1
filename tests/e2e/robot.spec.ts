import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("准备就绪", { exact: true })).toBeVisible({
    timeout: 20000,
  });
});
const pos = (page: import("@playwright/test").Page, axis = "z") =>
  page.getByTestId(`position-${axis}`).innerText().then(Number);
test("loads 3D model; keyboard motion, key release, blur, input focus, pause and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  expect(await page.locator("canvas").count()).toBe(1);
  const initial = await pos(page);
  await page.keyboard.down("w");
  await page.waitForTimeout(500);
  await page.keyboard.up("w");
  await page.waitForTimeout(120);
  expect(await pos(page)).toBeGreaterThan(initial + 0.01);
  const stopped = await pos(page);
  await page.waitForTimeout(200);
  expect(await pos(page)).toBe(stopped);
  await page.keyboard.down("s");
  await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(100);
  const blurred = await pos(page);
  await page.waitForTimeout(200);
  expect(await pos(page)).toBe(blurred);
  await page.keyboard.up("s");
  await page.locator("#speed").focus();
  const focused = await pos(page);
  await page.keyboard.down("w");
  await page.waitForTimeout(200);
  await page.keyboard.up("w");
  expect(await pos(page)).toBe(focused);
  await page.getByRole("button", { name: "暂停控制", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "向上移动 Z+" }),
  ).toBeDisabled();
  await page.keyboard.down("w");
  await page.waitForTimeout(150);
  await page.keyboard.up("w");
  expect(await pos(page)).toBe(focused);
  await page.getByRole("button", { name: "恢复控制", exact: true }).click();
  await page.getByRole("button", { name: "恢复初始姿态" }).click();
  await page.waitForTimeout(120);
  expect(await pos(page)).toBeCloseTo(initial, 3);
  expect(errors).toEqual([]);
});
test("tool IK, world directions, mode changes and pointer release", async ({
  page,
}) => {
  await page.getByRole("button", { name: "末端执行器", exact: true }).click();
  await page.waitForTimeout(150);
  const x = await pos(page, "x"),
    z = await pos(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  await page.waitForTimeout(120);
  expect(await pos(page, "x")).toBeGreaterThan(x + 0.02);
  expect(await pos(page)).toBeCloseTo(z, 2);
  const up = page.getByRole("button", { name: "向上移动 Z+" });
  const box = await up.boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.move(20, 20);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const stopped = await pos(page);
  await page.waitForTimeout(200);
  expect(await pos(page)).toBe(stopped);
  expect(stopped).toBeGreaterThan(z + 0.02);
  await page.getByRole("button", { name: "大臂肘部", exact: true }).click();
  await expect(page.getByText("肘部 · 世界坐标")).toBeVisible();
});
test("view controls, display toggles and accessible modal", async ({
  page,
}) => {
  await page.getByRole("button", { name: "俯视", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "俯视", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "重置视角", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "透视", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "网格", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "网格", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "使用指南" }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "使用指南" })).toBeFocused();
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(report.violations).toEqual([]);
});
test("model request failure has an actionable retry", async ({ page }) => {
  await page.route("**/robot.urdf", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await expect(page.getByText("暂时无法显示模型")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "向上移动 Z+" }),
  ).toBeDisabled();
  await page.unroute("**/robot.urdf");
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.getByText("准备就绪", { exact: true })).toBeVisible();
});
test("narrow viewport, touch direction and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const target = page.getByRole("button", { name: "向上移动 Z+" });
  await target.scrollIntoViewIfNeeded();
  const initial = await pos(page);
  const rect = await target.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: rect!.x + 20, y: rect!.y + 20 }],
  });
  await page.waitForTimeout(350);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(120);
  expect(await pos(page)).toBeGreaterThan(initial);
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(report.violations).toEqual([]);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
