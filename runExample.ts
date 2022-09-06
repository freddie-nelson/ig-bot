import { runExample, validateExample } from "./exampleRunner";

const example = validateExample(process.argv[2] || "");
runExample(example);
