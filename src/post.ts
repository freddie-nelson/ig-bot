export interface PostId {
  id: string;
  url: string;
  isPinned: boolean;
}

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
