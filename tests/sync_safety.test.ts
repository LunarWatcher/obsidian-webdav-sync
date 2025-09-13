import {ActionType, calculateSyncActions, FileData, resolveActions} from "../src/sync/sync";

describe("Action resolution", () => {
  it("should correctly identify file removals", () => {
    let dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    let actions = new Map([
      ["Index.md", ActionType.REMOVE]
    ]);
    expect(resolveActions(dest, actions).size).toStrictEqual(
      0
    )
  });
  it("should not duplicate on ADD", () => {
    let dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    let actions = new Map([
      ["Index.md", ActionType.ADD]
    ]);
    expect(resolveActions(dest, actions).size).toStrictEqual(
      1
    )
  });
  it("should register new files", () => {
    let dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    let actions = new Map([
      ["Trans rights are human rights.md", ActionType.ADD]
    ]);
    expect(resolveActions(dest, actions).size).toStrictEqual(
      2
    )
  });
  // This should never happen in practice, but it should be able to deal with it if it does
  it("should not die hard in the event of a non-existent removal", () => {
    let dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    let actions = new Map([
      ["Trans rights are human rights.md", ActionType.REMOVE]
    ]);
    expect(resolveActions(dest, actions).size).toStrictEqual(
      1
    )
  });
});

/**
 * Note that the examples in this set of tests are greatly exaggerated to intentionally trigger the problem. This does
 * mean that the block can happen on legitimate pushes, but this is seen as an acceptable tradeoff; full vault wipes are
 * exceedingly unlikely in established vaults, so we want protection.
 */
describe("calculateSyncActions", () => {
  it("should protect from full vault wipes", () => {
    let src = new Map<string, FileData>();
    const dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    const actionResult = calculateSyncActions(src, dest, ".obsidian", true, false, true);
    expect(actionResult.error).not.toBeNull();
    expect(actionResult.actions).toBeNull();
  });
  it("should protect from vault content wipes", () => {
    let src = new Map<string, FileData>([
      [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    const dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    const actionResult = calculateSyncActions(src, dest, ".obsidian", true, false, true);
    expect(actionResult.error).not.toBeNull();
    expect(actionResult.actions).toBeNull();
  });
  it("should not protect from full vault wipes if told to not care", () => {
    let src = new Map<string, FileData>();
    const dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    const actionResult = calculateSyncActions(src, dest, ".obsidian", true, false, false);
    expect(actionResult.error).toBeNull();
    expect(actionResult.actions).not.toBeNull();
  });
  it("should not protect from vault content wipes if told not to care", () => {
    let src = new Map<string, FileData>([
      [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    const dest = new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]);
    const actionResult = calculateSyncActions(src, dest, ".obsidian", true, false, false);
    expect(actionResult.error).toBeNull();
    expect(actionResult.actions).not.toBeNull();
  });
});
