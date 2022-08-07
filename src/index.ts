import IGBot from "./igBot";

async function main() {
  const bot = new IGBot("wow.wow.insta17", "Shari2612");
  await bot.init();
  await bot.login();
}

main();
