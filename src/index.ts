import IGBot from "./igBot";
import dotenv from "dotenv";
import { ProfileGender } from "./profile";
dotenv.config();

async function main() {
  const username = process.env.INSTA_USERNAME;
  const password = process.env.INSTA_PASSWORD;

  const bot = new IGBot(username, password, true);
  await bot.init();
  await bot.login();

  // console.log(await bot.getPosts("_brandontang_", 100));
  const recentPost = await bot.getRecentPost("_brandontang_");
  console.log(await bot.getPost(recentPost.id));
  // console.log(await bot.getPinnedPosts("_brandontang_"));
  // await bot.post("../test-post-video-0.mp4", {
  //   caption: "what an awesome funny meme video",
  //   location: "Epic Games",
  //   altText: "A funny wholesome video",
  //   disableComments: true,
  //   hideLikesAndViews: true,
  // });
  // for (let i = 0; i < 2; i++) {
  // await bot.post(
  //   ["../test-post-image-0.jpg", "../test-post-image-1.jfif", "../test-post-image-2.jpg"],
  //   "what an awesome funny meme post",
  // );
  // }
  // console.log(await bot.getProfile());
  // await bot.setProfile({
  //   // username: "simpkingmemes.v2",
  //   // password: process.env.INSTA_PASSWORD + "!",
  //   // email: "deathturd69@aol.com",
  //   // name: "Epic Funny Meme Man",
  //   // phoneNo: "+447452989421",
  //   gender: ProfileGender.MALE,
  //   // customGender: "poggers",
  //   bio: "poggers poggers poggers poggers poggers",
  //   website: "https://memerman.com",
  //   chaining: true,
  // });
  // console.log(await bot.getProfile());
  // await bot.logout();
  await bot.close();
}

main();
