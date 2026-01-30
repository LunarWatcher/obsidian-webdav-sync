import { App } from "obsidian";
import { AuthType, createClient, WebDAVClient } from "webdav";

export type DAVServerConfig = {
  username: string | undefined;
  password: string | undefined;
  url: string | null;
}

export const DEFAULT_DAV_CONFIG: DAVServerConfig = {
  username: undefined,
  password: undefined,
  url: null,
}

export class Connection {
  conf: DAVServerConfig;
  client: WebDAVClient;

  constructor(
    app: App,
    server_config: DAVServerConfig
  ) {
    if (
      server_config.url === null
      || server_config.password == null
    ) {
      return
    }
    this.conf = server_config;

    this.client = createClient(server_config.url, {
      username: server_config.username,
      password: app.secretStorage.getSecret(server_config.password)
        || /* fuck you typescript */ undefined,
      authType: AuthType.Auto,
      withCredentials: true,
    })
  }
}
