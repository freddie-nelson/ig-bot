import { Post } from "@/post";
import IGBot from "@lib/igBot";
import { Example } from "./example";

const getFeed: Example = async (username, password) => {
  const bot = new IGBot(username, password);
  await bot.init();
  await bot.login();

  const count = 10;

  const ids = await bot.getFeed(count);

  const posts: Post[] = [];
  for (const id of ids) {
    posts.push(await bot.getPost(id));
  }

  console.log(JSON.stringify(posts, null, 2));
  console.log(`Got ${posts.length} posts from feed.`);

  await bot.close();
};

export default getFeed;
