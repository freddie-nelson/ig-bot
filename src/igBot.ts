import { ElementHandle, Page } from "puppeteer";
import { createCursor, GhostCursor } from "ghost-cursor";
import { Scraper } from "./scraper";
import GhostKeyboard from "./ghostKeyboard";

export function createFlagDecorator(propertyGetter: string, errorMsg: string) {
  return () => {
    return (target: any, key: string, descriptor: PropertyDescriptor) => {
      if (!target[propertyGetter])
        throw new Error(`Target does not contain getter for '${propertyGetter}'.`);

      const originalFunc = descriptor.value;

      descriptor.value = function (...args: any[]) {
        if (target[propertyGetter].apply(this)) {
          return originalFunc.apply(this, args);
        } else {
          throw new Error(errorMsg.replace("$key", key));
        }
      };
    };
  };
}

const needsInit = createFlagDecorator(
  "getIsInitialised",
  "You must initalize the client before using '$key'.",
);
const needsLogin = createFlagDecorator(
  "getIsLoggedIn",
  "The client must be logged in before using '$key'.",
);

export default class IGBot extends Scraper {
  private baseInstagramUrl = new URL("https://instagram.com");
  private loginUrl = this.getUrl("/accounts/login");

  // client state flags
  private isInitialised = false;
  getIsInitialised() {
    return this.isInitialised;
  }

  private isLoggedIn = false;
  getIsLoggedIn() {
    return this.isLoggedIn;
  }

  private page: Page;
  private cursor: GhostCursor;
  private keyboard: GhostKeyboard;

  constructor(private username: string, private password: string) {
    super();
  }

  /**
   * Initializes the instagram client.
   */
  async init() {
    this.page = await this.newPage(this.getHref("/"));
    this.cursor = createCursor(this.page);
    this.keyboard = new GhostKeyboard(this.page);

    await this.acceptCookieConsent();

    this.isInitialised = true;
  }

  @needsInit()
  async login() {
    await this.acceptCookieConsent();
    await this.page.goto(this.loginUrl.href);

    const usernameInputSelector = "input[name='username']";
    const passwordInputSelector = "input[name='password']";
    const submitButtonSelector = "button[type='submit']";

    await this.page.waitForSelector(usernameInputSelector);
    await this.page.waitForSelector(passwordInputSelector);
    await this.page.waitForSelector(submitButtonSelector);

    await this.cursor.click(usernameInputSelector);
    await this.keyboard.type(this.username);

    await this.cursor.click(passwordInputSelector);
    await this.keyboard.type(this.password);

    await this.cursor.click(submitButtonSelector);
    await this.page.waitForNavigation();
  }

  async acceptCookieConsent() {
    const consentModalSelector = "div[role='dialog']";
    if (await this.page.$(consentModalSelector)) {
      const acceptBtn = <ElementHandle<Element>>(
        await this.findElementWithText(this.page, "button", "Only Allow Essential Cookies")
      );

      if (acceptBtn) await this.cursor.click(acceptBtn);
    }
  }

  private getUrl(path: string) {
    return new URL(path, this.baseInstagramUrl.origin);
  }

  private getHref(path: string) {
    return this.getUrl(path).href;
  }
}
