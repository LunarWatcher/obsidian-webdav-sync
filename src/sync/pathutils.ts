export function resolvePath(webdav: string, file: string) {
  return webdav + "/" + file
}

export function stripPrefix(path: string, root: string) {
  return path.replace(
    root + (
      root.endsWith("/") ? "" : "/"
    ), ""
  )
}

export function prefixToStr(prefix: string | null) {
  if (prefix == null) {
    return "";
  } else if (prefix.endsWith("/")) {
    return prefix;
  }
  return prefix + "/";
}
