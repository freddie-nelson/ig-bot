export interface PostId {
  id: string;
  url: string;
  isPinned: boolean;
}

export interface Post {
  id: string;
  url: string;
  username: string;
  likes: number;
  caption: string;
  media: string | string[];

  isVideo: boolean;
  views?: number;
}
