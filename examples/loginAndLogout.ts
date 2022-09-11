import IGBot from "@lib/igBot";
import { Example } from "./example";

const loginAndLogout: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();

  await bot.login();
  await bot.logout();
  await bot.login();

  await bot.close();
};

export default loginAndLogout;
