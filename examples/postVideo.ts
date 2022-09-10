import IGBot from "@lib/igBot";
import { Example } from "./example";

const postVideo: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();
  await bot.post("../test-post-video-0.mp4", {
    caption: "This is a slideshow post.",
  });
  await bot.close();
};

export default postVideo;
