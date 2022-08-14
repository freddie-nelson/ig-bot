import IGBot from "./igBot";
import dotenv from "dotenv";
import { ProfileGender } from "./profile";
dotenv.config();

async function main() {
  const bot = new IGBot(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD, false);
  await bot.init();
  await bot.login();
  // await bot.post("../test-post-video-0.mp4", "what an awesome funny meme video");
  // for (let i = 0; i < 2; i++) {
  // await bot.post(
  //   ["../test-post-image-0.jpg", "../test-post-image-1.jfif", "../test-post-image-2.jpg"],
  //   "what an awesome funny meme post",
  // );
  // }
  console.log(await bot.getProfile());
  await bot.setProfile({
    username: "simpkingmemes.v2",
    password: process.env.INSTA_USERNAME + "!",
    // email: "deathturd69@aol.com",
    // name: "Epic Funny Meme Man",
    phoneNo: "+447452989421",
    gender: ProfileGender.MALE,
    // customGender: "poggers",
    bio: "poggers poggers poggers poggers poggers",
    website: "https://memerman.com",
    chaining: true,
  });
  console.log(await bot.getProfile());
  // await bot.logout();
  await bot.close();
}

main();
