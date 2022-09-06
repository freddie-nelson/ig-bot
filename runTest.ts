import { createReadStream } from "fs";
import { stdout } from "process";
import { Duplex, PassThrough } from "stream";
import { availableExamples, runExample, validateExample } from "./exampleRunner";

const availableTests = ["all", ...availableExamples];

const validateTest = (test: string) => {
  const log = console.log;
  console.log = () => undefined;
  try {
    validateExample(test);
  } catch (error) {
    if (test !== "all") {
      console.log = log;
      console.log(
        `Usage: node runTest.js <test>\nValid tests: ${availableTests.join(
          ", ",
        )}\nIf no test is specified, all tests will be run.`,
      );
    }
  }

  console.log = log;
  return test;
};

const test = validateTest(process.argv[2] || "all");

const runTest = async (test: string) => {
  console.log(`🟦 Running test '${test}'...`);

  let success = false;
  let linesPrinted = 0;

  const log = console.log;
  console.log = (...args: any[]) => {
    linesPrinted += `${args.reduce((acc, a) => acc + " " + a.toString(), "")}`.split("\n").length;
    log(linesPrinted);

    log(...args);
  };

  try {
    await runExample(test);
    success = true;
  } catch (error) {
    console.error(error);
  }

  // clear lines printed by test
  console.log = log;

  for (let i = 0; i < linesPrinted; i++) {
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
  }

  if (success) console.log(`🟩 Test '${test}' passed.`);
  else console.log(`🟥 Test '${test}' failed, see above output for more information.`);

  return success;
};

(async () => {
  const tests = test === "all" ? [...availableExamples] : [test];

  let passedCount = 0;
  for (const test of tests) {
    const passed = await runTest(test);

    if (passed) console.log(`Passed ${++passedCount} of ${tests.length} tests.`);
  }

  if (passedCount === tests.length) {
    console.log("🟩 All tests passed.");
  } else {
    console.log(`🟥 ${passedCount} of ${tests.length} tests passed.`);
    console.log(
      `🟥 ${tests.length - passedCount} tests failed, check the above output for more information.`,
    );
  }
})();
