import IGBot from "@/igBot";
import { Example } from "./example";

const getComments: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "simpkingmemes.v2";
  console.log(`Getting comments from most recent post of '${user}'.`);

  const post = await bot.getRecentPost(user);
  const comments = await bot.getPostComments(post.id, 10, true);

  console.log(JSON.stringify(comments, null, 2));
  console.log(`Got ${comments.length} comments.`);

  await bot.close();
};

export default getComments;
