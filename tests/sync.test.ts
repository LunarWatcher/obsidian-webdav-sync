import {
  Actions,
  ActionType,
  calculateSyncActions,
  Content,
  FileData,
  Files,
  findDeletedFolders,
  Folder,
  OnUpdateCallback,
  runSync,
  SyncDir
} from "../src/sync/sync"

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

/**
 * Creates a Folder where the paths are the same. In real sync scenarios, this happens in full vault sync
 */
function lazyFolder(path: string): Folder {
  return {
    realPath: path,
    commonPath: path
  } as Folder;
}

function failHardOnError(err: string) {
  throw new Error(err);
}

/**
 * Dummy implementation of onUpdate. This implementation contains assertions that only work on files.
 * For mixed file and folder deletion tests, use laxOnUpdate.
 */
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
async function laxOnUpdate(
  testData: TestSyncStatus,
  extras: OnUpdateCallback | null,
  type: ActionType,
  path: string,
  localData: FileData | undefined,
  remoteData: FileData | undefined
) {
  if (type == ActionType.ADD) {
    testData.upload.push(path);
  } else if (type == ActionType.REMOVE){
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

function nofolders(files: Files): Content {
  return {
    files: files,
    folderPaths: []
  } as Content
}

describe("Sync with no files remotely means all are added", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map();
  const actionResult = calculateSyncActions(src, dest, ".obsidian");
  expect(actionResult.error).toBeNull();
  const actions = actionResult.actions as Actions;

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/webdav-sync/index.js", ActionType.ADD],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      nofolders(src),
      nofolders(dest),
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
      false
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
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actionResult = calculateSyncActions(src, dest, ".obsidian", true);
  expect(actionResult.error).toBeNull();
  const actions = actionResult.actions as Actions;

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/webdav-sync/index.js", ActionType.NOOP],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      nofolders(src),
      nofolders(dest),
      actions,
      failHardOnError,
      onUpdate.bind(this, testData, null),
      addOnConflict,
      false
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
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-05-21T00:00:00Z") } as FileData],
  ]);
  const actionResult = calculateSyncActions(src, dest, ".obsidian", true);
  expect(actionResult.error).toBeNull();
  const actions = actionResult.actions as Actions;

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/webdav-sync/index.js", ActionType.ADD],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      nofolders(src),
      nofolders(dest),
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
      false
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
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-05-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actionResult = calculateSyncActions(src, dest, ".obsidian", true);
  expect(actionResult.error).toBeNull();
  const actions = actionResult.actions as Actions;

  expect(actions).toStrictEqual(new Map([
    ["Index.md", ActionType.ADD],
    ["test/Hi.md", ActionType.ADD],
    [".obsidian/plugins/webdav-sync/index.js", ActionType.ADD_LOCAL],
  ]))
});

describe("Files missing locally should be removed", () => {
  let src = new Map([
    ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ["test/Hi.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const dest = new Map([
    [".obsidian/plugins/webdav-sync/index.js", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
  ]);
  const actionResult = calculateSyncActions(src, dest, ".obsidian");
  expect(actionResult.error).toBeNull();
  const actions = actionResult.actions as Actions;

  test("The actions are correctly computed", () =>  {
    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/webdav-sync/index.js", ActionType.REMOVE],
    ]));
  });
  test("The sync actions handled correctly", async () => {
    const testData = lazyTestData();
    await runSync(
      SyncDir.UP,
      nofolders(src),
      nofolders(dest),
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
      false
    );

    expect(testData.upload.length).toBe(2);
    expect(testData.remove.length).toBe(1);
    expect(testData.conflict.length).toBe(0);
  });
  test("except when deleteIsNoop, then it should be NOOP", () =>  {
    const actionResult = calculateSyncActions(src, dest, ".obsidian", true, true);
    expect(actionResult.error).toBeNull();
    const actions = actionResult.actions as Actions;

    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
      [".obsidian/plugins/webdav-sync/index.js", ActionType.NOOP],
    ]));
  });
  test("except when deleteIsNoop, then it should be NOOP, and omitted when not including noop", () =>  {
    const actionResult = calculateSyncActions(src, dest, ".obsidian", false, true);
    expect(actionResult.error).toBeNull();
    const actions = actionResult.actions as Actions;

    expect(actions).toStrictEqual(new Map([
      ["Index.md", ActionType.ADD],
      ["test/Hi.md", ActionType.ADD],
    ]));
  });
});

describe("Folders", () => {
  const src: Content = {
    files: new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/subfolder/Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]),
    folderPaths: [
      lazyFolder("test"),
      lazyFolder("test/subfolder"),
    ]
  };
  const dest: Content = {
    files: new Map([
      ["Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/subfolder/Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
      ["test/topfolder/Index.md", { lastModified: Date.parse("2025-06-21T00:00:00Z") } as FileData],
    ]),
    folderPaths: [
      lazyFolder("test"),
      lazyFolder("test/subfolder"),
      lazyFolder("test/topfolder"),
    ]
  };
  test("Should have the correct deletion actions computed", () => {
    const toDelete = findDeletedFolders(src.folderPaths, dest.folderPaths);
    expect(toDelete.length).toBe(1);
  });
  test("Should only have one reported deleted folder when deleting", async () => {
    const actionResult = calculateSyncActions(src.files, dest.files, ".obsidian");
    expect(actionResult.error).toBeNull();
    const actions = actionResult.actions as Actions;

    const testData = lazyTestData();
    let selfReported = await runSync(
      SyncDir.UP,
      src,
      dest,
      actions,
      failHardOnError,
      laxOnUpdate.bind(this, testData, async (
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
      false
    );

    expect(selfReported.actionedCount).toBe(1);
    expect(selfReported.actionedFolders).toBe(1);
    expect(selfReported.errorCount).toBe(0);

    expect(testData.upload.length).toBe(0);
    expect(testData.remove.length).toBe(2);
    expect(testData.conflict.length).toBe(0);
  });
})

test("Nested folders should not cause deletion exceptions", () => {

  const src = [
    lazyFolder("test"),
  ];
  const dest = [
    lazyFolder("test"),
    lazyFolder("test/subfolder"),
    lazyFolder("test/subfolder/subsubfolder"),
    lazyFolder("test/subfolder/subsubfolder/subsubsubfolder"),
  ];
  const toDelete = findDeletedFolders(src, dest);
  expect(toDelete).toStrictEqual([
    lazyFolder("test/subfolder/subsubfolder/subsubsubfolder"),
    lazyFolder("test/subfolder/subsubfolder"),
    lazyFolder("test/subfolder"),
  ])
})
