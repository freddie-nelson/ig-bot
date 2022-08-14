export enum ProfileGender {
  MALE = "Male",
  FEMALE = "Female",
  PREFER_NOT_TO_SAY = "Prefer not to say",
  CUSTOM = "CUSTOM",
}

export interface Profile {
  username: string;
  password: string;
  email: string;
  name: string;
  phoneNo: string;
  gender: ProfileGender;
  bio: string;
  website: string;
  chaining: boolean;
}
