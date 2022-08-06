export function useXPathLowerCase(textSelector = ".") {
  return `translate(${textSelector}, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')`;
}
