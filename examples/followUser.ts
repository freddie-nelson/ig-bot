import IGBot from "@lib/igBot";
import { Example } from "./example";

const followUser: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "kanyewest";
  await bot.followUser(user);

  await bot.close();
};

export default followUser;
