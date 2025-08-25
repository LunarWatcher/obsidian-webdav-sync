import { ActionType, calculateSyncActions, FileData, Path } from "../src/sync/sync"

test("No files remotely means all are added", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map();
  const actions = calculateSyncActions(src, dest);

  expect(actions).toStrictEqual(new Map([
    ["Index.md", ActionType.ADD],
    ["test/Hi.md", ActionType.ADD],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.ADD],
  ]))
});

test("One file matching in the remote means only two files are added", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actions = calculateSyncActions(src, dest, true);

  expect(actions).toStrictEqual(new Map([
    ["Index.md", ActionType.ADD],
    ["test/Hi.md", ActionType.ADD],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.NOOP],
  ]))
});

test("One outdated file in the remote means all three files are added", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-05-21T00:00:00Z") } as FileData],
  ]);
  const actions = calculateSyncActions(src, dest, true);

  expect(actions).toStrictEqual(new Map([
    ["Index.md", ActionType.ADD],
    ["test/Hi.md", ActionType.ADD],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.ADD],
  ]))
});

test("One outdated file locally should be detected", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-05-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actions = calculateSyncActions(src, dest, true);

  expect(actions).toStrictEqual(new Map([
    ["Index.md", ActionType.ADD],
    ["test/Hi.md", ActionType.ADD],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.ADD_LOCAL],
  ]))
});

test("Files missing locally should be removed", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actions = calculateSyncActions(src, dest);

  expect(actions).toStrictEqual(new Map([
    ["Index.md", ActionType.ADD],
    ["test/Hi.md", ActionType.ADD],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.REMOVE],
  ]))
});
