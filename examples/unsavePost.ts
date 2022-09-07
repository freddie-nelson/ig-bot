import IGBot from "@lib/igBot";
import { Example } from "./example";

const unsavePost: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  const recent = await bot.getRecentPost(user);
  await bot.unsavePost(recent);

  await bot.close();
};

export default unsavePost;
