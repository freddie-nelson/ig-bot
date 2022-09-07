import IGBot from "@lib/igBot";
import { Example } from "./example";

const post: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();
  await bot.post("../test-post-image-0.jpg", {
    caption: "This is a post.",
  });
  await bot.close();
};

export default post;
