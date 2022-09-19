import IGBot from "@lib/igBot";
import { Example } from "./example";

const getFollowers: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  const count = 50;

  const followers = await bot.getFollowers(user, count);
  console.log(followers);

  await bot.close();
};

export default getFollowers;
