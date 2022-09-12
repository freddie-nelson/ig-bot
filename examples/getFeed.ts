import IGBot from "@lib/igBot";
import { Example } from "./example";

const getFeed: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const count = 25;

  const ids = await bot.getFeed(count);
  console.log(ids);

  await bot.close();
};

export default getFeed;
