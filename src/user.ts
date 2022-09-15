export interface User {
  username: string;
  name: string;
  bio: string;
  profilePic: string;
  website: string;
  isVerified: boolean;
  isPrivate: boolean;
  followers: number;
  following: number;
  posts: number;
}
