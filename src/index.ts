import { resolve } from "path";
import IGBot from "./igBot";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const bot = new IGBot(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
  await bot.init();
  await bot.login();
  await bot.post(resolve(__dirname, "../test-post-image.jpg"));
}

main();

// import Hero from "@ulixee/hero";
// import Server from "@ulixee/server";

// (async () => {
//   const core = new Server();
//   await core.listen();

//   const hero = new Hero({
//     showChrome: true,
//     connectionToCore: { host: await core.address },
//   });

//   await hero.goto("https://ezgif.com/resize");
//   await hero.waitForLoad("AllContentLoaded");
//   await hero.waitForPaintingStable();

//   const acceptCookieButton = await hero.document.querySelector(
//     ".qc-cmp2-summary-buttons :nth-child(3)",
//   );
//   await hero.click(acceptCookieButton);
//   await hero.waitForMillis(5000);

//   const fileInput = await hero.document.querySelector("input[type='file']");
//   await hero.click(fileInput);

//   const fileChooser = await hero.waitForFileChooser();
//   fileChooser.chooseFiles(resolve(__dirname, "../test-post-image.jpg"));
// })();
