import { runExample, validateExample } from "./exampleRunner";

const example = validateExample(process.argv[2] || "");

(async () => {
  try {
    await runExample(example);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
