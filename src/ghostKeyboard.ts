import { KeyInput, Page } from "puppeteer";
import { useSpreadNum } from "./utils/useSpreadNum";

export default class GhostKeyboard {
  constructor(private page: Page) {}

  type(text: string) {
    this.page.waitForTimeout(useSpreadNum(200, 0.3));

    for (const char of text) {
      this.page.keyboard.press(<KeyInput>char, { delay: useSpreadNum(100) });
    }
  }
}
