import IGBot from "@lib/igBot";
import { Example } from "./example";

const setAccountPrivacy: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  console.log("Setting account to private.");
  await bot.setAccountPrivacy(true);

  if (await bot.isAccountPrivate()) {
    console.log("Account is now private.");
  } else {
    throw new Error("Failed to set account to private.");
  }

  console.log("Setting account to public.");
  await bot.setAccountPrivacy(false);

  if (!(await bot.isAccountPrivate())) {
    console.log("Account is now public.");
  } else {
    throw new Error("Failed to set account to public.");
  }

  await bot.close();
};

export default setAccountPrivacy;
