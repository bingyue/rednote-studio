import {
  test,
  expect,
} from "../../apps/web/node_modules/@playwright/test/index";
import path from "node:path";
test("complete creator workflow with previews, manual confirmation and history", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/create");
  await page.getByRole("button", { name: "新建笔记", exact: true }).click();
  await expect(page.getByLabel("笔记标题", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "选题生成", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "选题生成", exact: true });
  await dialog.getByLabel("主题 / 本次创作目标").fill("轻量工作");
  await dialog.getByRole("button", { name: "运行 Skill", exact: true }).click();
  await expect(dialog.getByText(/10 个可继续发展的选题/)).toBeVisible();
  await dialog
    .getByRole("button", { name: /预览并应用/ })
    .first()
    .click();
  let diff = page.getByRole("dialog", { name: "先看一看，再应用到稿件" });
  await diff.getByRole("button", { name: /确认应用/ }).click();
  await expect(diff).toHaveCount(0);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "笔记写作", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "笔记写作", exact: true });
  await dialog.getByLabel("主题 / 本次创作目标").fill("轻量工作");
  await dialog.getByRole("button", { name: "运行 Skill", exact: true }).click();
  await dialog
    .getByRole("button", { name: "预览全部修改", exact: true })
    .click();
  diff = page.getByRole("dialog", { name: "先看一看，再应用到稿件" });
  await diff.getByRole("button", { name: /确认应用/ }).click();
  await expect(diff).toHaveCount(0);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByLabel("笔记正文", { exact: true })).toHaveValue(
    /自己的节奏/,
  );
  await page.getByRole("button", { name: "封面设计", exact: true }).click();
  await page.getByRole("button", { name: "灵感便签", exact: true }).click();
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 PNG", exact: true }).click();
  expect((await png).suggestedFilename()).toBe("rednote-cover.png");
  await page.getByRole("button", { name: "文案编辑", exact: true }).click();
  await page.getByRole("button", { name: "检查内容", exact: true }).click();
  await expect(page.getByText("当前版本风险复核已完成")).toBeVisible();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await page.getByRole("button", { name: /准备发布/ }).click();
  await expect(
    page.getByRole("heading", { name: /发布前，再看一眼/ }),
  ).toBeVisible();
  await page.getByLabel("我已核对最终文案、账号、封面与素材使用权").check();
  await page.getByRole("button", { name: /确认最终稿，完成预检/ }).click();
  await page.getByRole("button", { name: /开始人工发布/ }).click();
  await page
    .getByLabel("真实作品链接")
    .fill("https://www.xiaohongshu.com/explore/abcdef0123456789abcdef01");
  await page.getByLabel("我已在目标账号完成发布，并核对该链接").check();
  await page.getByRole("button", { name: /确认并记录作品/ }).click();
  await expect(page.getByText("已保存人工发布记录")).toBeVisible();
  await page.getByRole("link", { name: "进入历史作品 →", exact: true }).click();
  await expect(
    page.locator("tbody").getByText("轻量工作｜从这3件小事开始"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("account selection persists and compliance edits/ignore are tied to a revision", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByRole("button", { name: "新建笔记", exact: true }).click();
  await expect(page.getByLabel("笔记标题", { exact: true })).toHaveValue("");
  await page.getByLabel("笔记标题", { exact: true }).fill("账号切换检查");
  await page
    .getByLabel("笔记正文", { exact: true })
    .fill("🌿 不要相信保证有效。");
  const account = page.getByLabel("稿件绑定账号");
  await account.selectOption({ label: "阿橙的城市漫游" });
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  await page.reload();
  await expect(account).toHaveValue(
    (await account
      .locator("option")
      .filter({ hasText: "阿橙的城市漫游" })
      .getAttribute("value")) || "",
  );
  await expect(page.getByLabel("笔记正文", { exact: true })).toHaveValue(
    "🌿 不要相信保证有效。",
  );
  await page.getByRole("button", { name: "检查内容", exact: true }).click();
  await expect(page.getByText("“保证有效”", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "记录复核理由", exact: true }).click();
  await page
    .getByLabel("为何在当前语境下保留此表达？")
    .fill("这是明确否定效果保证的语境");
  await page.getByRole("button", { name: "保存复核记录", exact: true }).click();
  await expect(page.getByText("当前版本风险复核已完成")).toBeVisible();
  await page.getByLabel("笔记正文", { exact: true }).fill("保证有效");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await page.getByRole("button", { name: "检查内容", exact: true }).click();
  await page.getByRole("button", { name: "采用建议", exact: true }).click();
  await expect(page.getByLabel("笔记正文", { exact: true })).toHaveValue(
    "可能适合部分人",
  );
  await expect(page.getByText("当前版本风险复核已完成")).toBeVisible();
});
test("offline single HTML supports navigation, local skill, edits and cover export", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await page.goto("file://" + path.resolve("prototype/index.html"));
  await expect(
    page.getByText("交互原型 / 演示数据", { exact: true }).first(),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "主导航" });
  await nav.getByRole("link", { name: "Skills" }).click();
  await expect(page.locator(".skill-card")).toHaveCount(8);
  await page.getByRole("button", { name: /选题生成/ }).click();
  const dialog = page.getByRole("dialog", { name: "选题生成", exact: true });
  await dialog.getByRole("button", { name: "运行 Skill", exact: true }).click();
  await expect(dialog.getByText(/10 个可继续发展的选题/)).toBeVisible();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await nav.getByRole("link", { name: "发布", exact: true }).click();
  await page.getByRole("button", { name: "周历", exact: true }).click();
  await expect(page.locator(".calendar-day")).toHaveCount(7);
  await nav.getByRole("link", { name: "账号", exact: true }).click();
  await expect(page.locator(".account-card")).toHaveCount(3);
  await nav.getByRole("link", { name: "创作", exact: true }).click();
  await page.getByLabel("笔记标题", { exact: true }).fill("离线编辑也能保存");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  await page.reload();
  await expect(page.getByLabel("笔记标题", { exact: true })).toHaveValue(
    "离线编辑也能保存",
  );
  expect(requests).toEqual([]);
});
test("narrow screen is usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/create");
  await page.getByRole("button", { name: "新建笔记", exact: true }).click();
  await expect(page.getByLabel("笔记标题", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("笔记标题", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "主导航菜单", exact: true }).click();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "Skills" })
    .click();
  await expect(page.locator(".skill-card")).toHaveCount(8);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
});

test("settings edits, authorized account creation and empty draft filtering work", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "添加规则", exact: true }).click();
  const d = page.getByRole("dialog", { name: "添加风险规则" });
  await d.getByLabel("匹配词", { exact: true }).fill("测试承诺");
  await d.getByLabel("建议替换", { exact: true }).fill("描述实际情况");
  await d.getByRole("button", { name: "保存规则", exact: true }).click();
  await expect(page.locator(".rules-list").getByText("测试承诺")).toBeVisible();
  await page.goto("/accounts");
  await page.getByRole("button", { name: "添加账号", exact: true }).click();
  const a = page.getByRole("dialog", { name: "添加自己的创作账号" });
  await a.getByLabel("账号昵称").fill("我的测试账号");
  await a.getByLabel("账号定位").fill("分享自己的生活记录");
  await a.getByRole("button", { name: "保存账号资料", exact: true }).click();
  await expect(
    page.locator(".account-card").getByText("我的测试账号", { exact: true }),
  ).toBeVisible();
  await page.goto("/create");
  await page.getByPlaceholder("搜索草稿…").fill("没有任何匹配的草稿");
  await expect(page.locator(".draft-row")).toHaveCount(0);
});
test("extension popup validates imports, copies, downloads and clears without page access", async ({
  page,
  context,
}) => {
  const fs = await import("node:fs/promises");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/extension-test/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    if (!["popup.html", "popup.js", "popup.css"].includes(name))
      return route.abort();
    const contentType = name.endsWith(".js")
      ? "text/javascript"
      : name.endsWith(".css")
        ? "text/css"
        : "text/html";
    await route.fulfill({
      contentType,
      body: await fs.readFile(path.resolve("apps/extension", name)),
    });
  });
  await page.addInitScript(() => {
    const data: any = {};
    (window as any).chrome = {
      storage: {
        local: {
          get: async (k: string) => ({ [k]: data[k] }),
          set: async (v: any) => Object.assign(data, v),
          remove: async (k: string) => {
            delete data[k];
          },
        },
      },
      tabs: {
        create: (v: any) => {
          (window as any).__opened = v.url;
        },
      },
    };
  });
  await page.goto("/extension-test/popup.html");
  await page.locator("#file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator("#status")).toContainText("资料格式无效");
  await page.locator("#file").setInputFiles({
    name: "rednote-publish.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "rednote-studio/1",
        title: "我的手记",
        body: "真实的日常",
        tags: ["日常"],
        account_name: "测试账号",
        task_id: "test",
      }),
    ),
  });
  await expect(page.locator("#title")).toHaveText("我的手记");
  await page.locator("#copy-title").click();
  await expect(page.locator("#status")).toContainText("标题已复制");
  const dl = page.waitForEvent("download");
  await page.locator("#download").click();
  expect((await dl).suggestedFilename()).toBe("rednote-note.txt");
  await page.locator("#open").click();
  expect(await page.evaluate(() => (window as any).__opened)).toBe(
    "https://creator.xiaohongshu.com/publish/publish",
  );
  await page.locator("#clear").click();
  await expect(page.locator("#content")).toBeHidden();
});
