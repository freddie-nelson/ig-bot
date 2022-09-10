import IGBot from "@/igBot";
import { Example } from "./example";

const getComments: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const user = "kanyewest";
  console.log(`Getting comments from most recent post of '${user}'.`);

  const post = await bot.getRecentPost(user);
  const comments = await bot.getComments(post.id, 30);

  console.log(JSON.stringify(comments, null, 2));
  console.log(`Got ${comments.length} comments.`);

  await bot.close();
};

export default getComments;
