import IGBot from "@lib/igBot";
import { Example } from "./example";

const sharePost: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  const shareTo = "xd.freddie";

  const recent = await bot.getRecentPost(user);
  await bot.sharePost(recent, shareTo, "Check out this post!");

  await bot.close();
};

export default sharePost;
