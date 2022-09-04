import IGBot from "@/igBot";
import { Example } from "./example";

const getProfile: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const profile = await bot.getProfile();
  console.log(JSON.stringify(profile, null, 2));

  await bot.close();
};

export default getProfile;
