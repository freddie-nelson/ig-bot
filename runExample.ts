import { readdirSync } from "fs";
import { config } from "dotenv";
config();

const availableExamples = readdirSync("examples")
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
  .map((f) => f.replace(".ts", ""));

const example = process.argv[2] || "";
if (!availableExamples.includes(example)) {
  console.log(
    `Usage: node runExample.js <example>\nValid examples: ${availableExamples.join(", ")}`,
  );
  process.exit(1);
}

(async () => {
  const examplePath = `examples/${example}.ts`;
  const exampleFunc = (await import(examplePath))?.default;
  if (!exampleFunc) {
    console.log(`Could not import '${examplePath}' or '${examplePath}' has no default export.`);
    process.exit(1);
  }

  if (typeof exampleFunc !== "function") {
    console.log(`'${examplePath}' does not export a function as the default export.`);
  }

  if (!process.env.INSTA_USERNAME || !process.env.INSTA_PASSWORD) {
    console.log(`Please set INSTA_USERNAME and INSTA_PASSWORD in your .env file.`);
    process.exit(1);
  }

  exampleFunc(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
})();
