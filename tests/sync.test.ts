import { ActionType, calculateSyncActions, FileData, OnUpdateCallback, runSync, SyncDir } from "../src/sync/sync"

interface TestSyncStatus {
  upload: string[];
  remove: string[];
  conflict: string[];
}
function lazyTestData(): TestSyncStatus {
  return {
    conflict: [],
    remove: [],
    upload: []
  };
}

function failHardOnError(err: string) {
  throw new Error(err);
}

async function onUpdate(
  testData: TestSyncStatus,
  extras: OnUpdateCallback | null,
  type: ActionType,
  path: string,
  localData: FileData | undefined,
  remoteData: FileData | undefined
) {
  expect(type).not.toBeUndefined();
  if (type == ActionType.ADD) {
    expect(localData).not.toBeUndefined();
    testData.upload.push(path);
  } else if (type == ActionType.REMOVE){
    expect(localData).toBeUndefined();
    expect(remoteData).not.toBeUndefined();
    testData.remove.push(path);
  }
  if (extras != null) {
    await extras(
      type,
      path,
      localData,
      remoteData
    );
  }
}

async function addOnConflict(
  _path: string,
  _src: FileData | undefined,
  _dest: FileData | undefined,
  _direction: SyncDir
): Promise<ActionType> {
  return ActionType.ADD;
}

describe("Sync with no files remotely means all are added", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map();
  const actions = calculateSyncActions(src, dest);

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.ADD],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      src,
      dest,
      actions,
      failHardOnError,
      onUpdate.bind(this, testData, async (
        type: ActionType,
        _path: string,
        _localData: FileData | undefined,
        remoteData: FileData | undefined
      ) => {
        if (type == ActionType.ADD) {
          expect(remoteData).toBeUndefined();
        }
      }),
      addOnConflict,
    );

    expect(testData.upload.length).toBe(3);
    expect(testData.remove.length).toBe(0);
    expect(testData.conflict.length).toBe(0);
  });
});

describe("Sync with one file matching in the remote means only two files are added", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actions = calculateSyncActions(src, dest, true);

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.NOOP],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      src,
      dest,
      actions,
      failHardOnError,
      onUpdate.bind(this, testData, null),
      addOnConflict,
    );

    expect(testData.upload.length).toBe(2);
    expect(testData.remove.length).toBe(0);
    expect(testData.conflict.length).toBe(0);
  });
});

describe("One outdated file in the remote means all three files are added", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-05-21T00:00:00Z") } as FileData],
  ]);
  const actions = calculateSyncActions(src, dest, true);

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.ADD],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      src,
      dest,
      actions,
      failHardOnError,
      onUpdate.bind(this, testData, async (
        type: ActionType,
        path: string,
        _localData: FileData | undefined,
        remoteData: FileData | undefined
      ) => {
        if (type == ActionType.ADD) {
          if (!path.startsWith(".obsidian")) {
            expect(remoteData).toBeUndefined();
          } else {
            expect(remoteData).not.toBeUndefined();
          }
        }
      }),
      addOnConflict,
    );

    expect(testData.upload.length).toBe(3);
    expect(testData.remove.length).toBe(0);
    expect(testData.conflict.length).toBe(0);
  });
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

describe("Files missing locally should be removed", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/obsidian-webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actions = calculateSyncActions(src, dest);

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/obsidian-webdav-sync/index.js", ActionType.REMOVE],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      src,
      dest,
      actions,
      failHardOnError,
      onUpdate.bind(this, testData, async (
        type: ActionType,
        path: string,
        _localData: FileData | undefined,
        remoteData: FileData | undefined
      ) => {
        if (type == ActionType.ADD) {
          if (!path.startsWith(".obsidian")) {
            expect(remoteData).toBeUndefined();
          } else {
            expect(remoteData).not.toBeUndefined();
          }
        }
      }),
      addOnConflict,
    );

    expect(testData.upload.length).toBe(2);
    expect(testData.remove.length).toBe(1);
    expect(testData.conflict.length).toBe(0);
  });
});
