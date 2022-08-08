import { isAbsolute, resolve } from "path";

/**
 * Converts the given path to an absolute path.
 *
 * If the given path is already an absolute path then the original path is returned.
 *
 * @param path The path to conver to an abslute path
 * @param rootDir The root dir to use when resolving relative paths, default is `__dirname`
 * @returns The absolute path of the given path
 */
export function useAbsolutePath(path: string, rootDir = __dirname) {
  if (!isAbsolute(path)) {
    return resolve(rootDir, path);
  } else {
    return path;
  }
}
