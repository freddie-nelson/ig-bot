import Hero, { LoadStatus } from "@ulixee/hero";
import Server from "@ulixee/server";
import { Profile } from "./profile";
import { useAbsolutePath } from "./utils/useAbsolutePath";
import { useSpreadNum } from "./utils/useSpreadNum";
import { useValidatePath } from "./utils/useValidatePath";
import { useValidInstagramMedia } from "./utils/useValidInstagramMedia";

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
  private logoutUrl = this.getUrl("/accounts/logout");
  private onetapLoginUrl = this.getUrl("/accounts/onetap");
  private editAccountUrl = this.getUrl("/accounts/edit");

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

  constructor(private username: string, private password: string, private showChrome = false) {}

  /**
   * Initializes the instagram client.
   */
  @needsFree()
  @makesBusy()
  async init() {
    this.core = new Server();
    await this.core.listen();

    this.hero = new Hero({
      showChrome: this.showChrome,
      connectionToCore: { host: await this.core.address },
    });
    this.hero.use(require.resolve("./fileChooserInterceptPlugin"));

    this.document = this.hero.document;
    this.isInitialised = true;

    await this.goto(this.baseInstagramUrl.href);
    await this.acceptCookieConsent();
  }

  @needsInit()
  async close() {
    await this.hero.close();
    await this.core.close();
  }

  async getProfile(): Promise<Profile> {
    await this.goto(this.editAccountUrl.href, true);

    return {
      username: this.getUsername(),
      password: this.getPassword(),
      email: await this.getEmail(),
      name: await this.getName(),
      phoneNo: await this.getPhoneNo(),
      gender: await this.getGender(),
      bio: await this.getBio(),
      website: await this.getWebsite(),
      chaining: await this.getChaining(),
    };
  }

  async getChaining(): Promise<Profile["chaining"]> {
    await this.goto(this.editAccountUrl.href, true);
    const input = await this.waitForElement("#pepChainingEnabled input[type='checkbox']");
    return await input.checked;
  }

  async getGender(): Promise<Profile["gender"]> {
    await this.goto(this.editAccountUrl.href, true);
    const input = await this.waitForElement("#pepGender");
    return String(await input.value);
  }

  async getPhoneNo(): Promise<Profile["phoneNo"]> {
    await this.goto(this.editAccountUrl.href, true);
    const input = await this.waitForElement("[id='pepPhone Number']");
    return String(await input.value);
  }

  async getEmail(): Promise<Profile["email"]> {
    await this.goto(this.editAccountUrl.href, true);
    const input = await this.waitForElement("#pepEmail");
    return String(await input.value);
  }

  async getBio(): Promise<Profile["bio"]> {
    await this.goto(this.editAccountUrl.href, true);
    const textarea = await this.waitForElement("#pepBio");
    return String(await textarea.value);
  }

  async getWebsite(): Promise<Profile["website"]> {
    await this.goto(this.editAccountUrl.href, true);
    const input = await this.waitForElement("#pepWebsite");
    return String(await input.value);
  }

  async getName(): Promise<Profile["name"]> {
    await this.goto(this.editAccountUrl.href, true);
    const input = await this.waitForElement("#pepName");
    return String(await input.value);
  }

  getUsername(): Profile["username"] {
    return this.username;
  }

  getPassword(): Profile["password"] {
    return this.password;
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
    console.log(
      `Posting ${
        Array.isArray(content) ? `[${content.map((p) => `'${p}'`).join(", ")}]` : `'${content}'`
      } with caption '${caption}'.`,
    );

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
      (p) => (useValidatePath(p), useValidInstagramMedia(useAbsolutePath(p))),
    );

    await fileChooser.chooseFiles(...contentAbsolute);

    // if this button shows then an error has occured while uploading, probably file types not being supported.
    const selectOtherFilesButton = await this.waitForElementWithText(
      "button",
      "Select Other Files",
      3e3,
    ).catch(() => null);
    if (selectOtherFilesButton) {
      throw new Error("Failed to upload files, most likely due to unsupported file types.");
    }

    // skip next 2 pages of post dialog
    for (let i = 0; i < 2; i++) {
      const nextButton = await this.waitForElementWithText("button", "next");
      await this.hero.click(nextButton);
      await this.hero.waitForMillis(useSpreadNum(1e3));
    }

    // enter caption
    const captionInput = await this.waitForElement("textarea[aria-label='Write a caption...']");
    await this.hero.click(captionInput);
    await this.hero.type(caption);

    // share post
    const shareButton = await this.waitForElementWithText("button", "share");
    await this.hero.click(shareButton);

    await this.waitForNoElement("img[alt='Spinner placeholder']", 300e3);

    if (await this.waitForElementWithText("div", "Post couldn't be shared", 3e3).catch(() => null))
      throw new Error("Failed to post, post couldn't be shared.");

    console.log("Posted.");
  }

  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async logout() {
    console.log(`Logging out '${this.username}'.`);
    await this.goto(this.logoutUrl.href);
    await this.waitForElement("input[name='username']");

    this.isLoggedIn = false;
    console.log("Logged out.");
  }

  @needsFree()
  @needsInit()
  @makesBusy()
  async login() {
    console.log(`Logging in as '${this.username}'.`);
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
    await this.waitForElement(loadingSpinnerSelector, 5e3).catch(() => null);
    await this.waitForNoElement(loadingSpinnerSelector, 30e3);
    await this.hero.waitForMillis(1000);

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
    await this.goto(this.onetapLoginUrl.href, true);

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
    await this.goto(this.baseInstagramUrl.href, true);
    await this.hero.waitForMillis(1e3);

    console.log("Checking for notifications consent modal.");
    const notificationsModalSelector = "div[role='dialog']";
    const notificationsModal = this.waitForElement(notificationsModalSelector, 5e3).catch(
      () => null,
    );

    if (!notificationsModal) {
      console.log("No notifications consent modal found.");
      return;
    }

    const declineButton = await this.waitForElementWithText("button", "not now", 10e3).catch(
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
    const consentModal = await this.waitForElement(consentModalSelector, 2e3).catch(() => null);

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
  protected async waitForNoElementWithText(
    tag: string,
    text: string,
    timeout?: number,
    exactMatch?: boolean,
    caseSensitive?: boolean,
    checksIntervalMs?: number,
  ) {
    console.log(`Waiting for no '${tag}' element to exist with textContent '${text}'.`);

    return this.waitFor(
      async () => !(await this.findElementWithText(tag, text, exactMatch, caseSensitive)),
      timeout,
      checksIntervalMs,
    );
  }

  @needsInit()
  protected async waitForElementWithText(
    tag: string,
    text: string,
    timeout?: number,
    exactMatch?: boolean,
    caseSensitive?: boolean,
    checksIntervalMs?: number,
  ) {
    console.log(`Waiting for '${tag}' element to exist with textContent '${text}'.`);

    return this.waitFor(
      () => this.findElementWithText(tag, text, exactMatch, caseSensitive),
      timeout,
      checksIntervalMs,
    );
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
      let elText = (await el.textContent) || "";
      if (!caseSensitive) elText = elText.toLowerCase();

      if (exactMatch && elText === text) return el;
      else if (elText.includes(text)) return el;
    }

    return null;
  }

  @needsInit()
  protected async waitForNoElement(selector: string, timeout?: number, checksIntervalMs?: number) {
    console.log(`Waiting for no element to exist with selector '${selector}'.`);

    return this.waitFor(
      async () => !(await this.querySelector(selector, true)),
      timeout,
      checksIntervalMs,
    );
  }

  @needsInit()
  protected async waitForElement(selector: string, timeout?: number, checksIntervalMs?: number) {
    console.log(`Waiting for element with selector '${selector}' to exist.`);

    return this.waitFor(() => this.querySelector(selector), timeout, checksIntervalMs);
  }

  /**
   * Waits for a value to be truthy.
   *
   * NOTE: `this.document` and maybe other variables will not work inside a waitForValue call for some reason.
   *       If you need to access the document, do so via another function call.
   *
   * @param waitForValue THe value to wait for to be truthy
   * @param timeout The time in ms before timing out, throws after timeout
   * @param checksIntervalMs The time in ms between value checks
   * @returns The last value returned from waitForValue
   */
  protected async waitFor<T>(
    waitForValue: () => Promise<T>,
    timeout = 10e3,
    checksIntervalMs = 100,
  ) {
    return new Promise<T>((resolve, reject) => {
      let timedOut = false;
      const id = timeout
        ? setTimeout(() => {
            timedOut = true;
          }, timeout)
        : null;

      (async () => {
        let value: T;
        while (!timedOut && !(value = await waitForValue())) {
          await this.hero.waitForMillis(checksIntervalMs);
        }
        if (timedOut) {
          reject();
          return;
        }

        if (id !== null) clearTimeout(id);
        resolve(value);
      })();
    });
  }

  @needsInit()
  protected async querySelector(selector: string, silent = false) {
    if (!silent) console.log(`Selecting element '${selector}'.`);

    const element = await this.document.querySelector(selector);
    if (!element) {
      if (!silent) console.log(`Could not find any element with selector '${selector}'.`);
      return null;
    }

    return element;
  }

  @needsInit()
  protected async goto(url: string, skipIfAlreadyOnUrl = false, waitForStatus?: LoadStatus) {
    if (skipIfAlreadyOnUrl && (await this.hero.url) === url) return;

    console.log(`Navigating to '${url}'.`);
    await this.hero.goto(url);
    console.log("Navigated, waiting for page to load.");
    try {
      await this.waitForLoad(waitForStatus);
    } catch (error) {
      console.log("Waiting for page load failed, waiting for additional 2 seconds and continuing.");
      console.log("waitForLoad Error (can ignore):", error);
      await this.hero.waitForMillis(2e3);
    }
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
