import { readdirSync } from "fs";
import { config } from "dotenv";
import { resolve } from "path";
config();

export const availableExamples = readdirSync("examples")
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
  .map((f) => f.replace(".ts", ""));

export const validateExample = (example: string) => {
  if (!availableExamples.includes(example)) {
    console.log(
      `Usage: node runExample.js <example>\nValid examples: ${availableExamples.join(", ")}`,
    );
    throw new Error("Invalid example.");
  }

  return example;
};

export const runExample = async (example: string) => {
  const examplePath = resolve(__dirname, `examples/${example}.ts`);
  const exampleFunc = (await import(examplePath))?.default;

  if (!exampleFunc) {
    throw new Error(`Could not import '${examplePath}' or '${examplePath}' has no default export.`);
  }

  if (typeof exampleFunc !== "function") {
    throw new Error(`'${examplePath}' does not export a function as the default export.`);
  }

  if (!process.env.INSTA_USERNAME || !process.env.INSTA_PASSWORD) {
    console.log(`Please set INSTA_USERNAME and INSTA_PASSWORD in your .env file.`);
    throw new Error("Missing instagram credentials.");
  }

  await exampleFunc(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
};
