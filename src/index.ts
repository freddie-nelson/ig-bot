import IGBot from "./igBot";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const bot = new IGBot(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD, false);
  await bot.init();
  await bot.login();
  // for (let i = 0; i < 2; i++) {
  await bot.post(
    ["../test-post-image-0.jpg", "../test-post-image-1.jfif", "../test-post-image-2.jpg"],
    "what an awesome funny meme post",
  );
  // }
  // await bot.post("../test-post-video-0.mp4", "what an awesome funny meme video");
  await bot.logout();
  await bot.close();
}

main();
