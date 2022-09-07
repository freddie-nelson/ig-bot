import IGBot from "@lib/igBot";
import { Example } from "./example";

const postSlideshow: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();
  await bot.post(
    ["../test-post-image-0.jpg", "../test-post-image-1.jfif", "../test-post-image-2.jpg"],
    {
      caption: "This is a slideshow post.",
    },
  );
  await bot.close();
};

export default postSlideshow;
