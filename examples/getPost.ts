import IGBot from "@/igBot";
import { Example } from "./example";

const getPost: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  const post = await bot.getPost(await bot.getRecentPost(user));
  console.log(JSON.stringify(post, null, 2));

  await bot.close();
};

export default getPost;
