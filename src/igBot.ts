import Hero, { ISuperElement, KeyboardKey, LoadStatus } from "@ulixee/hero";
import { ITypeInteraction } from "@ulixee/hero/interfaces/IInteractions";
import Server from "@ulixee/server";
import { Profile, ProfileGender } from "./profile";
import { useAbsolutePath } from "./utils/useAbsolutePath";
import { useSpreadNum } from "./utils/useSpreadNum";
import { useValidateEmail } from "./utils/useValidateEmail";
import { useValidatePath } from "./utils/useValidatePath";
import { useValidInstagramMedia } from "./utils/useValidInstagramMedia";
import { useValidURL } from "./utils/useValidURL";

export interface PostOptions {
  caption?: string;
  location?: string;
  altText?: string;
  hideLikesAndViews?: boolean;
  disableComments?: boolean;
}

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
  private baseInstagramUrl = new URL("https://www.instagram.com");
  private loginUrl = this.getUrl("/accounts/login");
  private logoutUrl = this.getUrl("/accounts/logout");
  private onetapLoginUrl = this.getUrl("/accounts/onetap");
  private editAccountUrl = this.getUrl("/accounts/edit");
  private changePasswordUrl = this.getUrl("/accounts/password/change");

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

  //
  // Set Profile Details Methods
  //

  async setProfile(profile: Partial<Profile> & { customGender?: string }) {
    console.log(`Setting ${Object.keys(profile).join(", ")} of profile.`);

    await this.goto(this.editAccountUrl.href);

    if (profile.chaining) await this.setChaining(profile.chaining);
    if (profile.gender && profile.gender !== ProfileGender.CUSTOM)
      await this.setGender(profile.gender);
    if (profile.gender && profile.gender === ProfileGender.CUSTOM)
      await this.setGender(profile.gender, profile.customGender);
    if (profile.phoneNo) await this.setPhoneNo(profile.phoneNo);
    if (profile.email) await this.setEmail(profile.email);
    if (profile.bio) await this.setBio(profile.bio);
    if (profile.website) await this.setWebsite(profile.website);
    if (profile.name) await this.setName(profile.name);
    if (profile.username) await this.setUsername(profile.username);
    if (profile.password) await this.setPassword(profile.password);

    console.log("Profile updated.");
  }

  async setChaining(chaining: Profile["chaining"]) {
    console.log(`Setting profile chaining to ${chaining}.`);
    await this.goto(this.editAccountUrl.href, true);

    const { element, input } = await this.getChainingElement();
    if ((await input.checked) !== chaining) {
      await this.hero.click(element);
      await this.saveProfileChanges(`Could not set chaining to '${chaining}', try again.`);
    }

    console.log("Profile chaining updated.");
  }

  async setGender(
    gender: ProfileGender.MALE | ProfileGender.FEMALE | ProfileGender.PREFER_NOT_TO_SAY,
  ): Promise<void>;
  async setGender(gender: ProfileGender.CUSTOM, customGender: string): Promise<void>;

  async setGender(gender: ProfileGender, customGender?: string) {
    if (gender === ProfileGender.CUSTOM && !customGender)
      throw new Error(`Custom gender is being set but no custom gender was provided.`);

    console.log(`Setting gender to ${gender === ProfileGender.CUSTOM ? customGender : gender}.`);

    await this.goto(this.editAccountUrl.href, true);

    const input = await this.getGenderElement();
    await this.hero.click(input);

    const fieldset = await this.waitForElement("fieldset");
    const [male, female, custom, preferNotToSay] = Array.from(await fieldset.children);

    switch (gender) {
      case ProfileGender.MALE:
        await this.hero.click(male);
        break;
      case ProfileGender.FEMALE:
        await this.hero.click(female);
        break;
      case ProfileGender.PREFER_NOT_TO_SAY:
        await this.hero.click(preferNotToSay);
        break;
      case ProfileGender.CUSTOM: {
        await this.hero.click(custom);
        const customInput = await this.waitForElement("input[name='customGenderSelection']");
        await this.hero.click(customInput);
        await this.clearInput();
        await this.hero.type(customGender);
        break;
      }
    }

    const doneButton = await this.waitForElementWithText("div[role='dialog'] button", "Done");
    await this.hero.click(doneButton);
    await this.waitForNoElement("div[role='dialog']");

    console.log("Profile gender updated.");
  }

  async setPhoneNo(phoneNo: Profile["phoneNo"]) {
    console.log(`Setting profile phone number to ${phoneNo}.`);

    await this.goto(this.editAccountUrl.href, true);

    const input = await this.getPhoneNoElement();
    await this.hero.click(input);
    await this.clearInput();
    await this.hero.type(phoneNo);

    await this.saveProfileChanges(
      `Could not set phone number to '${phoneNo}', check the provided phone number is valid and try again.`,
    );

    console.log("Profile phone number updated.");
  }

  async setEmail(email: Profile["email"]) {
    if (!useValidateEmail(email)) throw new Error("Invalid email address.");

    console.log(`Setting profile email to ${email}.`);

    await this.goto(this.editAccountUrl.href, true);

    const input = await this.getEmailElement();
    await this.hero.click(input);
    await this.clearInput();
    await this.hero.type(email);

    await this.saveProfileChanges(
      `Could not set email to '${email}', check the provided email is valid and try again.`,
    );

    console.log("Profile email updated.");
  }

  async setBio(bio: Profile["bio"]) {
    if (bio.length > 150) throw new Error("Bio cannot be longer than 150 characters.");

    console.log(`Setting profile bio to ${bio}.`);

    await this.goto(this.editAccountUrl.href, true);

    const input = await this.getBioElement();
    await this.hero.click(input);
    await this.clearInput();
    await this.hero.type(bio);

    await this.saveProfileChanges(
      `Could not set bio to '${bio}', check the provided bio is valid and try again.`,
    );

    console.log("Profile bio updated.");
  }

  async setWebsite(url: Profile["website"]) {
    if (!useValidURL(url)) throw new Error("Invalid url.");

    console.log(`Setting profile website to ${url}.`);

    await this.goto(this.editAccountUrl.href, true);

    const input = await this.getWebsiteElement();
    await this.hero.click(input);
    await this.clearInput();
    await this.hero.type(url);

    await this.saveProfileChanges(
      `Could not set website to '${url}', check the provided url is valid and try again.`,
    );

    console.log("Profile website updated.");
  }

  async setName(name: Profile["name"]) {
    if (name.length >= 64) throw new Error("Name must be less than 64 characters.");

    console.log(`Setting profile name to ${name}.`);

    await this.goto(this.editAccountUrl.href, true);

    const input = await this.getNameElement();
    await this.hero.click(input);
    await this.clearInput();
    await this.hero.type(name);

    await this.saveProfileChanges(
      `Could not set name to '${name}', check the provided name is valid and try again.`,
    );

    console.log("Profile name updated.");
  }

  async setUsername(username: Profile["username"]) {
    if (!username) throw new Error("Username cannot be empty.");
    if (username.length >= 30) throw new Error("Username must be less than 30 characters.");
    if (username.match(/[^a-zA-Z0-9_.]/))
      throw new Error(
        "Username can only contain alphanumeric characters, underscores and periods.",
      );

    console.log(`Setting username to ${username}.`);

    await this.goto(this.editAccountUrl.href, true);

    const input = await this.getUsernameElement();
    await this.hero.click(input);
    await this.clearInput();
    await this.hero.type(username);

    await this.saveProfileChanges(
      `Could not set username to '${username}', check the provided username is valid and try again.`,
    );

    this.username = username;

    console.log("Username updated.");
  }

  async setPassword(password: Profile["password"]) {
    if (!password) throw new Error("Password cannot be empty.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");

    console.log(`Setting password to ${password}.`);

    await this.goto(this.changePasswordUrl.href);

    const oldPassword = await this.waitForElement("input[name='cppOldPassword']");
    const newPassword = await this.waitForElement("input[name='cppNewPassword']");
    const confirmNewPassword = await this.waitForElement("input[name='cppConfirmPassword']");

    await this.hero.click(oldPassword);
    await this.hero.type(this.password);

    await this.hero.click(newPassword);
    await this.hero.type(password);

    await this.hero.click(confirmNewPassword);
    await this.hero.type(password);

    const changePasswordButton = await this.waitForElementWithText("button", "Change Password");
    await this.hero.click(changePasswordButton);

    const toastText = await this.waitForElement("div > div > div > div > div > p");
    if ((await toastText.textContent) !== "Password changed.")
      throw new Error(
        `Could not set password to '${password}', check the provided password is valid and try again.\nInstagram Error: ${await toastText.textContent}`,
      );

    this.password = password;

    console.log("Password updated.");
  }

  async saveProfileChanges(errorMsg: string) {
    console.log("Saving profile changes.");

    const submitButton = await this.waitForElementWithText("button", "Submit");
    if (await submitButton.disabled) {
      console.log("No changes to save.");
      return;
    }

    await this.hero.click(submitButton);

    const toastText = await this.waitForElement("div > div > div > div > div > p");
    if ((await toastText.textContent) !== "Profile saved.")
      throw new Error(`${errorMsg}\nInstagram Error: ${await toastText.textContent}`);

    await this.hero.waitForMillis(1e3);

    console.log("Profile changes saved.");
  }

  //
  // Get Profile Details Methods
  //

  async getProfile(): Promise<Profile> {
    console.log("Getting profile details.");

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
    console.log("Getting profile chaining.");

    await this.goto(this.editAccountUrl.href, true);
    const { input } = await this.getChainingElement();
    return await input.checked;
  }

  async getGender(): Promise<Profile["gender"]> {
    console.log("Getting profile gender.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getGenderElement();
    return <Profile["gender"]>String(await input.value);
  }

  async getPhoneNo(): Promise<Profile["phoneNo"]> {
    console.log("Getting profile phone number.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getPhoneNoElement();
    return String(await input.value);
  }

  async getEmail(): Promise<Profile["email"]> {
    console.log("Getting profile email.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getEmailElement();
    return String(await input.value);
  }

  async getBio(): Promise<Profile["bio"]> {
    console.log("Getting profile bio.");

    await this.goto(this.editAccountUrl.href, true);
    const textarea = await this.getBioElement();
    return String(await textarea.value);
  }

  async getWebsite(): Promise<Profile["website"]> {
    console.log("Getting profile website.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getWebsiteElement();
    return String(await input.value);
  }

  async getName(): Promise<Profile["name"]> {
    console.log("Getting profile name.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getNameElement();
    return String(await input.value);
  }

  getUsername(): Profile["username"] {
    return this.username;
  }

  getPassword(): Profile["password"] {
    return this.password;
  }

  //
  // Get Profile Elements Methods
  //

  async getChainingElement() {
    const input = await this.waitForElement("#pepChainingEnabled input[type='checkbox']");
    const element = await this.waitForElement("#pepChainingEnabled label div");

    return {
      input,
      element,
    };
  }

  async getGenderElement() {
    return await this.waitForElement("#pepGender");
  }

  async getPhoneNoElement() {
    return await this.waitForElement("[id='pepPhone Number']");
  }

  async getEmailElement() {
    return await this.waitForElement("#pepEmail");
  }

  async getBioElement() {
    return await this.waitForElement("#pepBio");
  }

  async getWebsiteElement() {
    return await this.waitForElement("#pepWebsite");
  }

  async getNameElement() {
    return await this.waitForElement("#pepName");
  }

  async getUsernameElement() {
    return await this.waitForElement("#pepUsername");
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
  async post(content: string | string[], options: PostOptions = {}) {
    console.log(
      `Posting ${
        Array.isArray(content) ? `[${content.map((p) => `'${p}'`).join(", ")}]` : `'${content}'`
      } with caption '${options.caption}'.`,
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
    if (options.caption) {
      const captionInput = await this.waitForElement("textarea[aria-label='Write a caption...']");
      await this.hero.click(captionInput);
      await this.hero.type(options.caption);
    }

    // enter location
    if (options.location) {
      const locationInput = await this.waitForElement("input[name='creation-location-input']");
      await this.hero.click(locationInput);
      await this.hero.type(options.location);

      // location result
      const topResultSpan = await this.waitForElement(
        "div[aria-hidden='false'] button div span",
        60e3,
      ).catch(() => null);
      if (!topResultSpan) throw new Error(`Invalid location, '${options.location}'.`);

      await this.hero.click(topResultSpan);
    }

    // enter alt text
    if (options.altText) {
      const accessibilityAccordion = await this.waitForElementWithText(
        "div[role='button'] > div",
        "Accessibility",
      );
      await this.hero.click(accessibilityAccordion);

      const altTextInput = await this.waitForElement("input[placeholder='Write alt text...']");
      await this.hero.click(altTextInput);
      await this.hero.type(options.altText);

      await this.hero.click(accessibilityAccordion);
    }

    // open advanced settings accordion
    if (options.hideLikesAndViews || options.disableComments) {
      const advancedSettingsAccordion = await this.waitForElementWithText(
        "div[role='button'] > div",
        "Advanced Settings",
      );
      await this.hero.click(advancedSettingsAccordion);
    }

    // hide likes and views
    if (options.hideLikesAndViews) {
      const title = await this.waitForElementWithText(
        "div > div > div",
        "Hide like and view counts on this post",
      );
      const toggle = await title.parentElement.querySelector("label");

      await this.hero.click(toggle);
    }

    // disable comments
    if (options.disableComments) {
      const title = await this.waitForElementWithText("div > div > div", "Turn off commenting");
      const toggle = await title.parentElement.querySelector("label");

      await this.hero.click(toggle);
    }

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

  async repeatKey(key: ITypeInteraction, count: number) {
    for (let i = 0; i < count; i++) {
      await this.hero.type(key);
      await this.hero.waitForMillis(40);
    }
  }

  /**
   * Performs Ctrl+A, then Backspace.
   *
   * Make sure you have a focused element before calling this.
   */
  async clearInput() {
    // select all text in input
    await this.hero.interact({ keyDown: KeyboardKey.ControlLeft });
    await this.hero.interact({ keyDown: KeyboardKey.A });
    await this.hero.interact({ keyUp: KeyboardKey.A });
    await this.hero.interact({ keyUp: KeyboardKey.ControlLeft });

    // delete all text in input
    await this.hero.type(KeyboardKey.Backspace);
  }

  @needsInit()
  protected async waitForNoElementWithText(
    selector: string,
    text: string,
    timeout?: number,
    exactMatch?: boolean,
    caseSensitive?: boolean,
    checksIntervalMs?: number,
  ) {
    console.log(`Waiting for no '${selector}' element to exist with textContent '${text}'.`);

    return this.waitFor(
      async () => !(await this.findElementWithText(selector, text, exactMatch, caseSensitive)),
      timeout,
      checksIntervalMs,
    );
  }

  @needsInit()
  protected async waitForElementWithText(
    selector: string,
    text: string,
    timeout?: number,
    exactMatch?: boolean,
    caseSensitive?: boolean,
    checksIntervalMs?: number,
  ) {
    console.log(`Waiting for '${selector}' element to exist with textContent '${text}'.`);

    return this.waitFor(
      () => this.findElementWithText(selector, text, exactMatch, caseSensitive),
      timeout,
      checksIntervalMs,
    );
  }

  @needsInit()
  protected async findElementWithText(
    selector: string,
    text: string,
    exactMatch = true,
    caseSensitive = false,
  ) {
    console.log(
      `Finding '${selector}' element with textContent ${
        exactMatch ? "of" : "containing"
      } '${text}'.`,
    );
    const elements = await this.document.querySelectorAll(selector);

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
  protected async goto(href: string, skipIfAlreadyOnUrl = false, waitForStatus?: LoadStatus) {
    const url = useValidURL(href);
    if (!url) throw new Error(`'goto' requires a valid URL, '${url}' is not valid.`);

    const currUrl = new URL(await this.hero.url);
    if (
      skipIfAlreadyOnUrl &&
      (currUrl.href === url.href ||
        (currUrl.href.endsWith("/") &&
          currUrl.href.substring(0, currUrl.href.length - 1) === url.href))
    )
      return;

    console.log(`Navigating to '${url.href}'.`);
    await this.hero.goto(url.href);
    console.log("Navigated, waiting for page to load.");
    try {
      await this.waitForLoad(waitForStatus);
    } catch (error) {
      console.log("Waiting for page load failed, waiting for additional 2 seconds and continuing.");
      console.log("waitForLoad Error (can ignore):", error);
      await this.hero.waitForMillis(2e3);
    }
    console.log(`Opened '${url.href}'.`);
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
