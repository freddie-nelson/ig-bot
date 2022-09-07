import IGBot from "@lib/igBot";
import { Example } from "./example";

const getRecent: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  console.log(`Getting most recent post from '${user}'.`);

  const post = await bot.getRecentPost(user);
  console.log(JSON.stringify(post, null, 2));

  await bot.close();
};

export default getRecent;
