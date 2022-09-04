import IGBot from "@/igBot";
import { Example } from "./example";

const getPosts: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  const count = 25;
  console.log(`Getting first ${count} posts from '${user}'.`);

  const posts = await bot.getPosts(user, count);
  console.log(JSON.stringify(posts, null, 2));

  await bot.close();
};

export default getPosts;
