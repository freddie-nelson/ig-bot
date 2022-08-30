import { PostIdentifer } from "@/post";

export function usePostIdentifierToId(identifier: PostIdentifer) {
  let id = "";
  const idRegex = /^([a-zA-Z0-9_-]+)$/;

  if (typeof identifier === "string") {
    const postUrlRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)\/?$/;

    if (postUrlRegex.test(identifier)) {
      id = identifier.match(postUrlRegex)[3];
    } else if (idRegex.test(identifier)) {
      id = identifier;
    } else {
      throw new Error("Invalid post identifier.");
    }
  } else if (idRegex.test(identifier.id)) {
    id = identifier.id;
  } else {
    throw new Error("Invalid post identifier.");
  }

  return id;
}
