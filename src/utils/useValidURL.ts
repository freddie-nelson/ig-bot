export function useValidURL(url: string) {
  try {
    return new URL(url);
  } catch (_) {
    return false;
  }
}
