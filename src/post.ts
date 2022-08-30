export interface PostInfo {
  id: string;
  url: string;
  isPinned: boolean;
}

/**
 * The id, url or {@link PostId} of a post.
 */
export type PostIdentifer = string | PostInfo | Post;

export interface Post {
  id: string;
  url: string;
  username: string;
  caption: string;
  isSlideshow: boolean;
  isVideo: boolean;
  media: string | string[];
  likes?: number;
  views?: number;
}
