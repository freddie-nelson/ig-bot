import { parse } from "path";

export function useValidInstagramMedia(path: string) {
  const ext = parse(path).ext;
  if (!ext.match(/(pjp)|(pjpeg)|(jpg)|(jpeg)|(jfif)|(heic)|(heif)|(png)|(mv4)|(mp4)|(mov)/))
    throw new Error(`'${path}' with filetype '${ext}' is not supported by instagram.`);

  return path;
}
