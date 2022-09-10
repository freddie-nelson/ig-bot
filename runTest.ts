import { spawn } from "child_process";
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
  const title = `\n🟦 Running test '${test}'...\n`;
  console.log(title);

  let errors = "";

  const success = await new Promise<boolean>((resolve) => {
    const exampleProc = spawn(
      "node",
      ["-r", "tsconfig-paths/register", "-r", "ts-node/register", "runExample.ts", test],
      { env: { ...process.env, TS_NODE_PROJECT: "examples/tsconfig.json" } },
    );
    exampleProc.on("exit", (code) => {
      resolve(code === 0);
    });

    exampleProc.stdout.pipe(process.stdout);
    exampleProc.stderr.pipe(process.stderr);

    // keep errors in memory so we can print them after the test is done
    exampleProc.stderr.on("data", (data) => {
      errors += String(data);
    });
  });

  // clear console and scroll buffer
  clearConsoleAndScrollBuffer();

  // reprint title and errors
  console.log(title);
  console.log(errors);

  // print footer
  if (success) console.log(`\n🟩 Test '${test}' passed.`);
  else console.log(`\n🟥 Test '${test}' failed, see above output for more information.`);

  return success;
};

(async () => {
  const tests = test === "all" ? [...availableExamples] : [test];

  let passedCount = 0;
  const failedTests: string[] = [];

  for (const test of tests) {
    const passed = await runTest(test);

    if (passed) console.log(`Passed ${++passedCount} of ${tests.length} tests.`);
    else failedTests.push(test);
  }

  if (passedCount === tests.length) {
    console.log("🟩 All tests passed.");
  } else {
    console.log(`🟥 ${passedCount} of ${tests.length} tests passed.`);
    console.log(
      `🟥 ${tests.length - passedCount} tests failed, check below for the tests that failed.`,
    );
    console.log(`🟥 Failed tests: ${failedTests.join(", ")}`);
  }
})();

function clearConsoleAndScrollBuffer() {
  process.stdout.write("\u001b[3J\u001b[1J");
  console.clear();
}
