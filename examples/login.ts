import IGBot from "@lib/igBot";
import { Example } from "./example";

const login: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();
  await bot.close();
};

export default login;
