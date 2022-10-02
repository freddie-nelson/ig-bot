import IGBot from "@lib/igBot";
import { Example } from "./example";

const getFollowing: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  const count = 50;

  const following = await bot.getFollowing(user, count);
  console.log(following);

  await bot.close();
};

export default getFollowing;
