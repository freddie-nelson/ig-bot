import IGBot from "./igBot";

async function main() {
  const bot = new IGBot("xd.freddie", "Shari2612");
  await bot.init();
  await bot.login();
}

main();
