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
  media: string | string[];
  likes?: number;

  isVideo: boolean;
  views?: number;
}
