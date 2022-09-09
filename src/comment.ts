export interface Comment {
  poster: string;
  text: string;
  likes: number;
  timestamp: number;
  replies: Comment[];
}
