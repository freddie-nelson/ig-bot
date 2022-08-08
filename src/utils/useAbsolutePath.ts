import Callsite from "callsite";
import { dirname, isAbsolute, resolve } from "path";

/**
 * Converts the given path to an absolute path.
 *
 * If the given path is already an absolute path then the original path is returned.
 *
 * @param path The path to conver to an abslute path
 * @returns The absolute path of the given path
 */
export function useAbsolutePath(path: string) {
  if (!isAbsolute(path)) {
    const stack = Callsite();
    const rootDir = dirname(stack[1].getFileName());
    return resolve(rootDir, path);
  } else {
    return path;
  }
}
