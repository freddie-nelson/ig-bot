import { sayHello } from "./hello";

describe("hello logger", () => {
  it("Outputs 'Hello World!' to the console.", () => {
    const logSpy = jest.spyOn(console, "log");
    sayHello();

    expect(logSpy).toHaveBeenCalledWith("Hello World!");
  });
});
