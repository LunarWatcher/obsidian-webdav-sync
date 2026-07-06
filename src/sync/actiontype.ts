export enum ActionType {
  ADD,
  REMOVE,
  /**
   * Used for files that have changed remotely. This should result in a notification to the user before actually making
   * changes, just in case it's wrong.
   *
   * This field must be filtered out prior to passing to the sync implementation functions. Specifically, it MUST decay
   * to ADD, REMOVE, or NOOP, as the sync implementations assume all conflict resolution has already been done.
   */
  ADD_LOCAL,
  NOOP
};

export function actionToDescriptiveString(action: ActionType): string {
  switch (action) {
  case ActionType.ADD:
    return "Add or update";
  case ActionType.REMOVE:
    return "Remove";
  case ActionType.ADD_LOCAL:
    return "Conflict identified; ask user";
  case ActionType.NOOP:
    return "No changes made";
  }
}
