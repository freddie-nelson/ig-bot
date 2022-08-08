import isValidPath from "is-valid-path";

/**
 * Validates a file path.
 *
 * @throws When the given path is not a valid file path
 *
 * @param path The path to validate
 * @returns The given file path
 */
export function useValidatePath(path: string) {
  if (!isValidPath(path)) throw new Error(`'${path}' is not a valid file path.`);

  return path;
}
