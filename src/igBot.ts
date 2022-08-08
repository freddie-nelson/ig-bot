import Hero, { LoadStatus, LocationStatus, XPathResult } from "@ulixee/hero";
import Server from "@ulixee/server";
import {
  ClientFileChooserInterceptPlugin,
  CoreFileChooserInterceptPlugin,
} from "./fileChooserInterceptPlugin";
import { useAbsolutePath } from "./utils/useAbsolutePath";
import { useSpreadNum } from "./utils/useSpreadNum";
import { useValidatePath } from "./utils/useValidatePath";
import { useXPathLowerCase } from "./utils/useXPathLowerCase";

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

const needsFree = createFlagDecorator(
  "getIsFree",
  "The client must be free in order to use '$key'.",
);

const makesBusy = () => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalFunc = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      this.isBusy = true;
      const returnVal = await originalFunc.apply(this, args);
      this.isBusy = false;

      return returnVal;
    };
  };
};

const gracefulHeroClose = () => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalFunc = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!this.hero || !(this.hero instanceof Hero))
        throw new Error("Hero instance does not exist on target.");

      try {
        return originalFunc.apply(this, args);
      } catch (error) {
        await this.close();
        console.log("Closed hero instance.");
        throw error;
      }
    };
  };
};

export default class IGBot {
  private baseInstagramUrl = new URL("https://instagram.com");
  private loginUrl = this.getUrl("/accounts/login");
  private onetapLoginUrl = this.getUrl("/accounts/onetap");

  private core: Server;
  private hero: Hero;
  private document: Hero["document"];

  // client state flags
  private isInitialised = false;
  getIsInitialised() {
    return this.isInitialised;
  }

  private isLoggedIn = false;
  getIsLoggedIn() {
    return this.isLoggedIn;
  }

  private isBusy = false;
  getIsBusy() {
    return this.isBusy;
  }
  getIsFree() {
    return !this.isBusy;
  }

  constructor(private username: string, private password: string) {}

  /**
   * Initializes the instagram client.
   */
  @needsFree()
  @makesBusy()
  async init() {
    this.core = new Server();
    await this.core.listen();

    this.hero = new Hero({ showChrome: true, connectionToCore: { host: await this.core.address } });
    this.hero.use(require.resolve("./fileChooserInterceptPlugin"));

    this.document = this.hero.document;
    this.isInitialised = true;

    await this.goto(this.baseInstagramUrl.href);
    await this.acceptCookieConsent();
  }

  @needsInit()
  async close() {
    await this.hero.close();
  }

  /**
   * Creates a post.
   *
   * @param content The content to post, an array of values will be posted as a slideshow
   * @param caption The caption to add to the post, default is no caption.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async post(content: string | string[], caption = "") {
    await this.goto(this.baseInstagramUrl.href);

    // open post dialog
    const createPostButton = await this.waitForElement("[aria-label='New post']");
    await this.hero.click(createPostButton);

    await this.waitForElement("div[role='dialog']");

    // upload files
    await (this.hero as any).interceptFileChooser();

    const chooseFileButton = await this.waitForElementWithText("button", "select from computer");
    await this.hero.click(chooseFileButton);

    console.log("Waiting for file chooser.");
    const fileChooser = await this.hero.waitForFileChooser();
    const contentAbsolute = (Array.isArray(content) ? content : [content]).map(
      (p) => (useValidatePath(p), useAbsolutePath(p)),
    );

    await fileChooser.chooseFiles(...contentAbsolute);

    // skip next 2 pages of post dialog
    for (let i = 0; i < 2; i++) {
      const nextButton = await this.waitForElementWithText("button", "next");
      await this.hero.click(nextButton);
      await this.hero.waitForMillis(useSpreadNum(1000));
    }

    // enter caption
    const captionInput = await this.waitForElement("textarea[aria-label='Write a caption...']");
    await this.hero.click(captionInput);
    await this.hero.type(caption);

    // share post
    const shareButton = await this.waitForElementWithText("button", "share");
    await this.hero.click(shareButton);
  }

  @needsFree()
  @needsInit()
  @makesBusy()
  async login() {
    await this.goto(this.loginUrl.href);

    const usernameInputSelector = "input[name='username']";
    const usernameInput = await this.querySelector(usernameInputSelector);

    const passwordInputSelector = "input[name='password']";
    const passwordInput = await this.querySelector(passwordInputSelector);

    const submitButtonSelector = "button[type='submit']";
    const submitButton = await this.querySelector(submitButtonSelector);

    console.log(`Entering username, '${this.username}'.`);
    await this.hero.click(usernameInput);
    await this.hero.type(this.username);

    console.log(`Entering password, '${this.password}'.`);
    await this.hero.click(passwordInput);
    await this.hero.type(this.password);

    console.log("Submitting login details.");
    await this.hero.click(submitButton);

    // wait for response
    const loadingSpinnerSelector = `${submitButtonSelector} [data-visualcompletion='loading-state']`;
    const loadingSpinner = await this.querySelector(loadingSpinnerSelector);
    await this.hero.waitForElement(loadingSpinner);
    await this.waitForNoElement(loadingSpinnerSelector);
    await this.hero.waitForMillis(500);

    console.log("Checking for login errors.");
    const errorMsg = await this.querySelector("[role='alert']");
    if (errorMsg) {
      console.log("Failed to login, you may want to check your username and password.");
      console.log(`Instagram Error: ${await errorMsg.textContent}`);
      throw new Error("Failed to login.");
    }

    console.log("Waiting for post login redirect.");
    await this.waitForNavigationConditional(this.loginUrl.pathname);

    this.isLoggedIn = true;
    console.log("Logged in.");

    console.log("Setting up for scraping after login.");

    // escape isBusy flag
    this.isBusy = false;
    await this.declineOnetapLogin();
    await this.declineNotifications();
    this.isBusy = true;
  }

  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async declineOnetapLogin() {
    await this.goto(this.onetapLoginUrl.href);

    const declineButton = await this.findElementWithText("button", "not now");

    console.log("Declining onetap login.");
    await this.hero.click(declineButton);

    console.log("Waiting for redirect to instagram homepage.");
    await this.waitForNavigation();
  }

  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async declineNotifications() {
    await this.goto(this.baseInstagramUrl.href);
    await this.hero.waitForMillis(1000);

    console.log("Checking for notifications consent modal.");
    const notificationsModalSelector = "div[role='dialog']";
    const notificationsModal = this.waitForElement(notificationsModalSelector, 5000).catch(
      () => null,
    );

    if (!notificationsModal) {
      console.log("No notifications consent modal found.");
      return;
    }

    const declineButton = await this.waitForElementWithText("button", "not now", 5000).catch(
      () => null,
    );
    if (!declineButton) {
      console.log("No notifications decline button found.");
      return;
    }

    await this.hero.click(declineButton);
    await this.waitForNoElement(notificationsModalSelector);
    console.log("Declined notifications.");
  }

  @needsInit()
  async acceptCookieConsent() {
    await this.hero.waitForPaintingStable();

    console.log("Checking for cookie consent modal.");
    const consentModalSelector = "div[role='dialog']";
    const consentModal = await this.waitForElement(consentModalSelector, 2000).catch(() => null);

    if (!consentModal) {
      console.log("No cookie consent modal found.");
      return;
    }

    console.log("Modal found, attempting to accept cookies.");

    const acceptBtn = await this.findElementWithText("button", "Only Allow Essential Cookies");
    if (!acceptBtn) {
      console.log("No cookie accept button found.");
      return;
    }

    await this.hero.click(acceptBtn);
    await this.waitForNoElement(consentModalSelector);
    console.log("Accepted cookies.");
  }

  @needsInit()
  protected async waitForElementWithText(
    tag: string,
    text: string,
    timeout = 10000,
    exactMatch = true,
    caseSensitive = false,
    checksIntervalMs = 50,
  ) {
    console.log(`Waiting for '${tag}' element to exist with textContent '${text}'.`);

    return new Promise<ReturnType<typeof this.document.querySelector>>((resolve, reject) => {
      const id = setTimeout(() => {
        console.log(
          `Timeout of ${timeout}ms ran out and '${tag}' element with textContent '${text}' could not be found.`,
        );
        reject();
      }, timeout);

      (async () => {
        let element: ReturnType<typeof this.document.querySelector>;
        while (!(element = await this.findElementWithText(tag, text, exactMatch, caseSensitive))) {
          await this.hero.waitForMillis(checksIntervalMs);
        }

        clearTimeout(id);
        resolve(element);
      })();
    });
  }

  @needsInit()
  protected async findElementWithText(
    tag: string,
    text: string,
    exactMatch = true,
    caseSensitive = false,
  ) {
    console.log(
      `Finding '${tag}' element with textContent ${exactMatch ? "of" : "containing"} '${text}'.`,
    );
    const elements = await this.document.querySelectorAll(tag);

    if (!caseSensitive) text = text.toLowerCase();

    for (const el of elements) {
      let elText = await el.textContent;
      if (!caseSensitive) elText = elText.toLowerCase();

      if (exactMatch && elText === text) return el;
      else if (elText.includes(text)) return el;
    }

    return null;
  }

  @needsInit()
  protected async waitForNoElement(selector: string, timeout = 10000, checksIntervalMs = 50) {
    console.log(`Waiting for no element to exist with selector '${selector}'.`);

    return new Promise<void>((resolve, reject) => {
      const id = setTimeout(() => {
        console.log(
          `Timeout of ${timeout}ms ran out and element with selector '${selector}' still existed.`,
        );
        reject();
      }, timeout);

      (async () => {
        while (await this.document.querySelector(selector)) {
          await this.hero.waitForMillis(checksIntervalMs);
        }

        clearTimeout(id);
        resolve();
      })();
    });
  }

  @needsInit()
  protected async waitForElement(selector: string, timeout = 10000, checksIntervalMs = 50) {
    console.log(`Waiting for element with selector '${selector}' to exist.`);

    return new Promise<ReturnType<typeof this.document.querySelector>>((resolve, reject) => {
      const id = setTimeout(() => {
        console.log(
          `Timeout of ${timeout}ms ran out and no element with selector '${selector}' could be found.`,
        );
        reject();
      }, timeout);

      (async () => {
        while (!(await this.document.querySelector(selector))) {
          await this.hero.waitForMillis(checksIntervalMs);
        }

        clearTimeout(id);
        resolve(await this.document.querySelector(selector));
      })();
    });
  }

  @needsInit()
  protected async querySelector(selector: string) {
    console.log(`Selecting element '${selector}'.`);

    const element = await this.document.querySelector(selector);
    if (!element) {
      console.log(`Could not find any element with selector '${selector}'.`);
      return null;
    }

    return element;
  }

  @needsInit()
  protected async goto(url: string, waitForStatus?: LoadStatus) {
    console.log(`Navigating to '${url}'.`);
    await this.hero.goto(url);
    console.log("Navigated, waiting for page to load.");
    await this.waitForLoad(waitForStatus);
    console.log(`Opened '${url}'.`);
  }

  /**
   * Calls waitForNavigation if `hero.url` includes `match`.
   *
   * @param match The string to match for in the url
   * @param trigger The waitForLocation trigger
   * @param status The waitForLoad status to wait for from the page
   */
  @needsInit()
  protected async waitForNavigationConditional(
    match: string,
    trigger: "change" | "reload" = "change",
    status?: LoadStatus,
  ) {
    if ((await this.hero.url).includes(match)) await this.waitForNavigation(trigger, status);
  }

  /**
   * Calls hero's waitForLocation and then waitForLoad.
   *
   * @param trigger The waitForLocation trigger
   * @param status The waitForLoad status to wait for from the page
   */
  @needsInit()
  protected async waitForNavigation(trigger: "change" | "reload" = "change", status?: LoadStatus) {
    await this.hero.waitForLocation(trigger);
    await this.waitForLoad(status);
  }

  @needsInit()
  protected async waitForLoad(status: LoadStatus = LoadStatus.AllContentLoaded) {
    await this.hero.waitForLoad(status);
  }

  private getUrl(path: string) {
    return new URL(path, this.baseInstagramUrl.origin);
  }

  private getHref(path: string) {
    return this.getUrl(path).href;
  }
}
