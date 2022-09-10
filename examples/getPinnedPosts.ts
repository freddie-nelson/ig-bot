import IGBot from "@lib/igBot";
import { Example } from "./example";

const getPinnedPosts: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  console.log(`Getting all pinned posts from '${user}'.`);

  const pinned = await bot.getPinnedPosts(user);
  console.log(JSON.stringify(pinned, null, 2));

  await bot.close();
};

export default getPinnedPosts;
