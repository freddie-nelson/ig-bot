import IGBot from "@lib/igBot";
import { Example } from "./example";

const getUser: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const uname = "simpkingmemes.v2";

  const user = await bot.getUser(uname);
  console.log(user);

  await bot.close();
};

export default getUser;
