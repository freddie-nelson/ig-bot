import Hero, { ISuperHTMLElement, KeyboardKey, LoadStatus } from "@ulixee/hero";
import { ITypeInteraction } from "@ulixee/hero/interfaces/IInteractions";
import Server from "@ulixee/server";
import { Post, PostIdentifer, PostInfo } from "./post";
import {
  createFlagDecorator,
  makesBusy,
  needsFree,
  needsInit,
  needsLogin,
} from "./classDecorators";
import { Profile, ProfileGender } from "./profile";
import { useAbsolutePath } from "./utils/useAbsolutePath";
import { useEscapeRegex } from "./utils/useEscapeRegex";
import { usePostIdentifierToId } from "./utils/usePostIdentifierToId";
import { useSpreadNum } from "./utils/useSpreadNum";
import { useValidateEmail } from "./utils/useValidateEmail";
import { useValidatePath } from "./utils/useValidatePath";
import { useValidInstagramMedia } from "./utils/useValidInstagramMedia";
import { useValidURL } from "./utils/useValidURL";
import { Comment } from "./comment";

export interface PostOptions {
  caption?: string;
  location?: string;
  altText?: string;
  hideLikesAndViews?: boolean;
  disableComments?: boolean;
}

export default class IGBot {
  protected baseInstagramUrl = new URL("https://www.instagram.com");
  protected graphqlUrl = this.getUrl("/graphql/query");
  protected loginUrl = this.getUrl("/accounts/login");
  protected logoutUrl = this.getUrl("/accounts/logout");
  protected onetapLoginUrl = this.getUrl("/accounts/onetap");
  protected editAccountUrl = this.getUrl("/accounts/edit");
  protected changePasswordUrl = this.getUrl("/accounts/password/change");

  protected core: Server;
  protected hero: Hero;
  protected document: Hero["document"];

  // client state flags
  protected isInitialised = false;
  getIsInitialised() {
    return this.isInitialised;
  }

  protected isLoggedIn = false;
  getIsLoggedIn() {
    return this.isLoggedIn;
  }

  protected isBusy = false;
  getIsBusy() {
    return this.isBusy;
  }
  getIsFree() {
    return !this.isBusy;
  }

  constructor(
    protected username: string,
    protected password: string,
    protected showChrome = false,
  ) {}

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

  /**
   * Close the instagram client.
   *
   * The client will need to be reinitialized before it can be used again.
   */
  @needsInit()
  @needsFree()
  @makesBusy()
  async close() {
    await this.hero.close();
    await this.core.close();

    this.isInitialised = false;
    this.isLoggedIn = false;
    this.isBusy = false;
  }

  //
  // Post Methods
  //

  /**
   * Unsaves a post.
   *
   * @param post The post to unsave
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async unsavePost(post: PostIdentifer) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    console.log(`Unsaving post '${id}'.`);

    await this.goto(url, true);

    // check if post is already saved
    this.isBusy = false;
    if (!(await this.isPostSaved(post))) {
      console.log("Post is already not saved.");
      return;
    }
    this.isBusy = true;

    // click unsave button
    const unsaveButtonIcon = await this.waitForElement("article section [aria-label='Remove']");
    const unsaveButton = await unsaveButtonIcon.parentElement.parentElement;
    await this.hero.click(unsaveButton);

    // wait for post to be saved
    await this.hero.waitForResource({
      url: /instagram.com\/web\/save\/(.*)\/unsave\//,
      type: "XHR",
    });

    console.log(`Unsaved post.`);
  }

  /**
   * Saves a post.
   *
   * @param post The post to save
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async savePost(post: PostIdentifer) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    console.log(`Saving post '${id}'.`);

    await this.goto(url, true);

    // check if post is already saved
    this.isBusy = false;
    if (await this.isPostSaved(post)) {
      console.log("Post is already saved.");
      return;
    }
    this.isBusy = true;

    // click save button
    const saveButtonIcon = await this.waitForElement("[aria-label='Save']");
    const saveButton = await saveButtonIcon.parentElement.parentElement;
    await this.hero.click(saveButton);

    // wait for post to be saved
    await this.hero.waitForResource({
      url: /instagram.com\/web\/save\/(.*)\/save\//,
      type: "XHR",
    });

    console.log(`Saved post.`);
  }

  /**
   * Gets wether a post is saved by the currently logged in user.
   *
   * @param post The post to check if it is saved
   * @returns Whether the post is saved
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async isPostSaved(post: PostIdentifer) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    await this.goto(url, true);

    return (await this.waitForElement("[aria-label='Save']", 2e3).catch(() => null)) === null;
  }

  /**
   * Shares a post.
   *
   * @param post The post to share
   * @param user The username of the user or users to share the post with
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async sharePost(post: PostIdentifer, user: string | string[], message?: string) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    console.log(`Sharing post '${id}' with user(s) '${user}'.`);

    await this.goto(url, true);

    // click share button
    const shareButtonIcon = await this.waitForElement("[aria-label='Share Post']");
    const shareButton = await shareButtonIcon.parentElement.parentElement;
    await this.hero.click(shareButton);

    // wait for share dialog to open
    const dialogSelector = "[role='dialog']";
    await this.waitForElement(dialogSelector);

    const usernames = typeof user === "string" ? [user] : [...user];

    // add usernames to share
    for (const username of usernames) {
      const usernameInput = await this.waitForElement(`${dialogSelector} input[name='queryBox']`);
      await this.hero.click(usernameInput);
      await this.hero.type(username);

      // wait for loading to complete
      await this.waitForElement(
        `${dialogSelector} [data-visualcompletion='loading-state']`,
        2e3,
      ).catch(() => null);
      await this.waitForNoElement(
        `${dialogSelector} [data-visualcompletion='loading-state']`,
        60e3,
      );

      // check for no accounts found
      const noAccountsFound =
        (await this.waitForElementWithText(`${dialogSelector} div`, "No account found.", 1e3).catch(
          () => null,
        )) !== null;
      if (noAccountsFound) {
        throw new Error(`No account found for username '${username}' when trying to share post.`);
      }

      const topMatchUser = await this.waitForElement(`${dialogSelector} div[role='button']`);
      await this.hero.click(topMatchUser);
    }

    // write message
    if (message) {
      const messageInput = await this.waitForElement(
        `${dialogSelector} input[name='shareCommentText']`,
      );
      await this.hero.click(messageInput);
      await this.hero.type(message);
    }

    // click send button
    const sendButton = await this.waitForElementWithText(`${dialogSelector} button`, "Send");
    await this.hero.click(sendButton);

    // wait for sent
    const messageToast = await this.getMessageToast(120e3);
    if (!messageToast) {
      throw new Error(`Failed to share post, timed out waiting for share to complete.`);
    } else if (!(await messageToast.innerText).includes("Sent")) {
      throw new Error(`Failed to share post.\nInstagramError: ${await messageToast.innerText}`);
    }

    console.log(`Shared post '${id}' with user(s) '${user}'.`);
  }

  /**
   * Comments on a post.
   *
   * @param post The post to comment on.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async comment(post: PostIdentifer, comment: string) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    console.log(`Commenting on post '${id}'.`);

    await this.goto(url, true);

    // type comment
    const commentInput = await this.waitForElement("textarea[placeholder='Add a comment…']");
    await this.hero.click(commentInput);
    await this.clearInput();

    // type comment, while replacing newlines with Shift+Enter
    const lines = comment.split("\n");
    for (let i = 0; i < lines.length; i++) {
      await this.hero.type(lines[i]);

      if (i < lines.length - 1) {
        await this.hero.interact({ keyDown: KeyboardKey.Shift }, { keyPress: KeyboardKey.Enter });
        await this.hero.interact({ keyUp: KeyboardKey.Shift });
        await this.hero.waitForMillis(200);
      }
    }

    // submit comment
    await this.hero.interact({ keyPress: KeyboardKey.Enter });

    // wait for comment to be posted
    await this.waitForElement("[aria-label='Loading...']").catch(() => null);
    await this.waitForNoElement("[aria-label='Loading...']", 60e3);

    // check for error
    const toastMessage = await this.getMessageToast();
    if (toastMessage) {
      throw new Error(
        `Failed to comment '${comment}' on post '${url}'.\nInstagramError: ${await toastMessage.textContent}`,
      );
    }

    console.log(`Commented '${comment}' on post '${id}'.`);
  }

  /**
   * Unlikes a post.
   *
   * @param post The post to unlike.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async unlikePost(post: PostIdentifer) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    console.log(`Unliking post '${id}'.`);

    await this.goto(url, true);

    this.isBusy = false;
    if (!(await this.isPostLiked(post))) {
      console.log("Post is already not liked.");
      return;
    }
    this.isBusy = true;

    // click unlike button
    const unlikeButtonIcon = await this.waitForElement("article section [aria-label='Unlike']");
    const unlikeButton = await unlikeButtonIcon.parentElement.parentElement;
    await this.hero.click(unlikeButton);

    // wait for response from server
    await this.hero.waitForResource({
      url: /instagram.com\/web\/likes\/(.*)\/unlike\//,
      type: "XHR",
    });

    console.log(`Unliked post '${id}'.`);
  }

  /**
   * Likes a post.
   *
   * @param post The identifier of the post to like.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async likePost(post: PostIdentifer) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    console.log(`Liking post '${id}'.`);

    await this.goto(url, true);

    this.isBusy = false;
    if (await this.isPostLiked(post)) {
      console.log("Post is already liked.");
      return;
    }
    this.isBusy = true;

    // click the like button
    const likeButtonIcon = await this.waitForElement("article section [aria-label='Like']");
    const likeButton = await likeButtonIcon.parentElement.parentElement;
    await this.hero.click(likeButton);

    // wait for response from server
    await this.hero.waitForResource({
      url: /instagram.com\/web\/likes\/(.*)\/like\//,
      type: "XHR",
    });

    console.log(`Liked post '${id}'.`);
  }

  /**
   * Gets whether a post is liked by the currently logged in user.
   *
   * @param post The identifier of the post.
   * @returns Whether the post is liked.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async isPostLiked(post: PostIdentifer) {
    const id = usePostIdentifierToId(post);
    const url = this.getHref(`/p/${id}/`);

    await this.goto(url, true);

    return (
      (await this.waitForElement("article section [aria-label='Like']", 2e3).catch(() => null)) ===
      null
    );
  }

  /**
   * Gets the comments of a post.
   *
   * TODO: Implement getting replies of comments.
   *
   * @param identifier The identifier of the post.
   * @param count The number of comments to get.
   * @param getReplies Wether to get the replies of the comments. @default false
   * @returns An array of comments.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getPostComments(
    identifier: PostIdentifer,
    count: number,
    getReplies = false,
  ): Promise<Comment[]> {
    const id = usePostIdentifierToId(identifier);
    const url = this.getHref(`/p/${id}/`);

    console.log(`Getting comments for post '${id}'.`);

    await this.goto(url, true);

    // get comments
    const comments: Comment[] = [];
    const postContainerSelector = "section article";

    let commentElements: ISuperHTMLElement[] = [];
    const moreCommentsButtonSelector = `${postContainerSelector} svg[aria-label='Load more comments']`;
    const moreCommentsLoadingSelector = `${postContainerSelector} ul [data-visualcompletion='loading-state']`;

    do {
      if (comments.length !== 0) {
        // try to load more comments
        const moreCommentsButton = await this.waitForElement(moreCommentsButtonSelector);
        if (moreCommentsButton) {
          await this.hero.click(moreCommentsButton);
          await this.waitForElement(moreCommentsLoadingSelector);
          await this.waitForNoElement(moreCommentsLoadingSelector);
        }
      }

      // get comment elements
      await this.waitForElement(`${postContainerSelector} ul > ul`); // make sure comments are loaded
      commentElements = Array.from(
        await this.hero.querySelectorAll(`${postContainerSelector} ul > ul`),
      );

      // remove comments that have already been added
      commentElements = commentElements.slice(comments.length);

      for (const commentElement of commentElements) {
        const commentInfoElement = (await commentElement.children[0]).querySelector(
          "li > div > div > :nth-child(2)",
        );

        const commentPosterElement = await commentInfoElement.children[0];
        const commentTextElement = await commentInfoElement.children[1];

        const commentExtraElement = await (await commentInfoElement.children[2]).children[0];
        const commentTimestampElement = await commentExtraElement.querySelector("time");
        const commentLikeElement = await (await commentExtraElement.children[1]).children[0];

        const comment: Comment = {
          poster: String(await commentPosterElement.textContent).trim(),
          text: String(await commentTextElement.textContent).trim(),
          timestamp: new Date(
            String(await commentTimestampElement.getAttribute("datetime")),
          ).getTime(),
          likes: Number(
            String(await commentLikeElement.textContent)
              .replace(/(likes)|(like)/, "")
              .trim()
              .replace(",", ""),
          ),
          replies: [],
        };
        comments.push(comment);
      }
    } while (comments.length < count && commentElements.length > 0);

    console.log(`Got ${comments.length} comments for post '${id}'.`);
    return comments.slice(0, count);
  }

  /**
   * Gets detailed information about a post.
   *
   * @param identifier The identifier of the post to get.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getPost(identifier: PostIdentifer): Promise<Post> {
    const id = usePostIdentifierToId(identifier);
    const url = this.getHref(`/p/${id}/`);

    // get post info
    console.log(`Getting post info for post '${id}'.`);

    await this.goto(url);

    // get post info from api request made by page
    const info = await this.hero
      .waitForResource({
        url: /i.instagram.com\/api\/v1\/media\/(.*)\/info\//,
        type: "XHR",
      })
      .then(async (resource) => (await resource.json).items[0]);

    const isVideo = info.media_type === 2;
    const isSlideshow = !!info.carousel_media;

    let media: Post["media"] = "";
    if (isSlideshow) {
      media = info.carousel_media.map((media: any) =>
        media.media_type === 2
          ? media.video_versions[0].url
          : media.image_versions2.candidates[0].url,
      );
    } else if (isVideo) {
      media = info.video_versions[0].url;
    } else {
      media = info.image_versions2.candidates[0].url;
    }

    console.log("Got post info.");

    return {
      id,
      url,
      username: info.user.username,
      caption: info.caption.text,
      likes: info.like_count,
      isSlideshow,
      isVideo,
      media,
      views: info?.view_count,
    };

    // GET POST INFO FROM SCRAPING

    // const aside = await this.waitForElement(
    //   "article[role='presentation'] div[role='presentation']",
    // );

    // // get username
    // const header = await aside.querySelector("header");
    // const profilePic = await header.querySelector("img"); // username is stored in alt attribute of profile pic

    // // username is first word in alt text and is followed by "'s", so we can split on "'s "
    // const username = await (await profilePic.getAttribute("alt")).split("'s ")[0];
    // if (!username) throw new Error("Could not get username.");

    // // get caption
    // const description = String(
    //   await (
    //     await this.waitForElement("meta[property='og:title']")
    //   ).content,
    // );

    // const startOfCaption = description.indexOf('Instagram: "') + 'Instagram: "'.length;
    // const caption = startOfCaption !== undefined ? description.slice(startOfCaption, -1) : "";

    // // get likes
    // const likesAnchorSelector = `a[href='/p/${id}/liked_by/']`;
    // const allLikesAnchors = await aside.querySelectorAll(likesAnchorSelector);

    // const isOtherLikes = (await allLikesAnchors.length) > 1;
    // const likesAnchor = isOtherLikes ? allLikesAnchors[1] : allLikesAnchors[0];
    // const likesElement = await likesAnchor.querySelector("span");

    // let likes = undefined;
    // if (likesElement) {
    //   likes = Number((await likesElement.textContent)?.replace(",", "")) + (isOtherLikes ? 1 : 0);
    // }

    // return {
    //   id,
    //   url,
    //   username,
    //   caption,
    //   likes,
    //   media: "",
    //   isVideo: false,
    //   views: undefined,
    // };
  }

  /**
   * Gets a user's pinned posts.
   *
   * @param username The username of the user to get posts from.
   * @param count The number of posts to get. @default Infinity
   *
   * @returns An array of {@link PostInfo} objects for each pinned post.
   */
  getPinnedPosts(username: string, count = Infinity) {
    return this.getPosts(username, count, false, true);
  }

  /**
   * Gets a user's most recent post.
   *
   * This method does not include pinned posts in it's search.
   *
   * @param username
   *
   * @returns The user's most recent post, if it exists.
   */
  getRecentPost(username: string) {
    return this.getPosts(username, 1).then((posts) => posts[0]);
  }

  /**
   * Gets a user's posts.
   *
   * By default, this method does not include pinned posts in it's search.
   *
   * @param username The username of the user to get posts from.
   * @param count The maxium number of posts to get, `Infinity` will get all posts.
   * @param filterPinned Whether to filter out pinned posts. @default true
   * @param onlyPinned Whether to only get pinned posts. @default false
   *
   * @returns An array of {@link PostInfo} objects for each post.
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getPosts(
    username: string,
    count: number,
    filterPinned = true,
    onlyPinned = false,
  ): Promise<PostInfo[]> {
    console.log(`Getting ${count} posts by '${username}'.`);

    await this.goto(this.getHref(`/${username}`));

    // check if user exists
    if (await this.isPageNotFound()) {
      throw new Error(`User '${username}' does not exist.`);
    }

    const allPosts: PostInfo[] = [];
    let lastPostRead: PostInfo; // this acts as 'cursor' for infinite scroll pagination
    let rowElementHeight = 0;
    let currentScrollY = 0;
    let noMorePinned = false;

    console.log("Finding post elements and extracting links.");
    while (allPosts.length < count) {
      // if this isn't first time reading posts, scroll for more posts
      if (lastPostRead) {
        currentScrollY += rowElementHeight * 4;
        await Promise.all([
          this.hero.scrollTo([0, currentScrollY]),
          this.hero.waitForResource({
            url: new RegExp(`${useEscapeRegex(this.graphqlUrl.href)}/\\?query_hash=(.*)`),
          }),
        ]);
      }

      // get next rows of posts
      const container = await this.waitForElement("article > div > div");
      const rows = Array.from(await container.children);

      // save row element height for scrolling for more posts
      rowElementHeight = await rows[0].clientHeight;

      // get post elements from rows
      const postElements: ISuperHTMLElement[] = [];
      for (const r of rows) {
        postElements.push(...Array.from(await r.children));
      }

      // add posts
      const posts: PostInfo[] = [];

      for (const p of postElements) {
        const link = await p.querySelector("a");
        if (!link) continue;

        // filter out pinned posts if necessary
        const isPinned = (await p.querySelector("[aria-label='Pinned post icon']")) !== null;
        if (filterPinned && isPinned) continue;

        // exit if we've reached the end of pinned posts
        // (if we're only getting pinned posts)
        if (onlyPinned && !isPinned) {
          noMorePinned = true; // set flag to exit outer loop
          break;
        }

        // add post to current posts list
        const url = this.getHref(await link.getAttribute("href"));
        posts.push({
          id: url.split("/p/").pop().slice(0, -1),
          url,
          isPinned,
        });
      }

      // remove already read posts
      if (lastPostRead) {
        posts.splice(posts.indexOf(lastPostRead));
      }

      // we have reached the end of the user's posts
      if (posts.length === 0) break;

      lastPostRead = posts[posts.length - 1];
      allPosts.push(...posts);

      console.log(`Found ${Math.min(count, allPosts.length)} / ${count} posts.`);

      // we have reached the end of the user's pinned posts
      // this means that onlyPinned is also true
      // so we exit here and return posts, which will only be pinned posts
      if (noMorePinned) break;
    }

    // limit posts to count
    allPosts.length = Math.min(count, allPosts.length);

    return allPosts;
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

  //
  // Auth Methods
  //

  /**
   * Logs in to Instagram using `this.username` and `this.password`.
   */
  @needsFree()
  @needsInit()
  @makesBusy()
  async login() {
    if (this.isLoggedIn) throw new Error(`Already logged in to instagram, you must logout first.`);

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
      console.log(`InstagramError: ${await errorMsg.textContent}`);
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
  async logout() {
    if (!this.isLoggedIn) throw new Error(`Not logged in to instagram.`);

    console.log(`Logging out '${this.username}'.`);
    await this.goto(this.logoutUrl.href);
    await this.waitForElement("input[name='username']");

    this.isLoggedIn = false;
    console.log("Logged out.");
  }

  //
  // Set Profile Details Methods
  //

  /**
   * Sets the currently logged in user's profile details.
   *
   * @param profile The profile details to set
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async setProfile(profile: Partial<Profile> & { customGender?: string }) {
    console.log(`Setting ${Object.keys(profile).join(", ")} of profile.`);

    await this.goto(this.editAccountUrl.href);

    // make free so that set methods can run
    this.isBusy = false;

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

  /**
   * Sets the currently logged in user's chaining value.
   *
   * @param chaining Whether to enable chaining
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's gender.
   *
   * @param gender The new gender
   */
  async setGender(
    gender: ProfileGender.MALE | ProfileGender.FEMALE | ProfileGender.PREFER_NOT_TO_SAY,
  ): Promise<void>;

  /**
   * Sets the currently logged in user's gender.
   *
   * @param gender `ProfileGender.CUSTOM`
   * @param customGender The new gender
   */
  async setGender(gender: ProfileGender.CUSTOM, customGender: string): Promise<void>;

  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's phone number.
   *
   * @param phoneNo The new phone number
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's email.
   *
   * @param email The new email
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's bio.
   *
   * @param bio The new bio
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's website.
   *
   * @param url A valid URL to be the new website
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's name.
   *
   * This is the name that will be displayed on the profile, not the username.
   *
   * @param name The new name
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's username.
   *
   * Updates `this.username` when successful.
   *
   * Instagram usernames must follow these rules:
   *  - Must be between 1 and 30 characters long, inclusive
   *  - Must contain only letters, numbers, periods and underscores
   *
   * Usernames also cannot be changed too often.
   *
   * @param username The new username
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

  /**
   * Sets the currently logged in user's password.
   *
   * Updates `this.password` when successful.
   *
   * @param password The new password
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
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

    const toastMessage = await this.getMessageToast();
    if ((await toastMessage?.textContent) !== "Password changed.")
      throw new Error(
        `Could not set password to '${password}', check the provided password is valid and try again.\nInstagramError: ${await toastMessage.textContent}`,
      );

    this.password = password;

    console.log("Password updated.");
  }

  @needsInit()
  @needsLogin()
  @makesBusy()
  protected async saveProfileChanges(errorMsg: string) {
    console.log("Saving profile changes.");

    const submitButton = await this.waitForElementWithText("button", "Submit");
    if (await submitButton.disabled) {
      console.log("No changes to save.");
      return;
    }

    await this.hero.click(submitButton);

    const toastMessage = await this.getMessageToast();
    if ((await toastMessage?.textContent) !== "Profile saved.")
      throw new Error(`${errorMsg}\nInstagramError: ${await toastMessage.textContent}`);

    await this.hero.waitForMillis(1e3);

    console.log("Profile changes saved.");
  }

  //
  // Get Profile Details Methods
  //

  /**
   * Gets the profile details of the currently logged in user.
   *
   * @returns The profile details of the logged in user
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getProfile(): Promise<Profile> {
    console.log("Getting profile details.");

    await this.goto(this.editAccountUrl.href, true);

    // make free so that get methods can be used
    this.isBusy = false;

    return {
      email: await this.getEmail(),
      name: await this.getName(),
      phoneNo: await this.getPhoneNo(),
      gender: await this.getGender(),
      bio: await this.getBio(),
      website: await this.getWebsite(),
      chaining: await this.getChaining(),

      // at bottom as these don't makeBusy
      username: this.getUsername(),
      password: this.getPassword(),
    };
  }

  /**
   * Gets wether the currently logged in user has chaining enabled.
   *
   * Chaining is a feature that allows your instagram account to be
   * recommended to other users as suggestions of accounts to follow.
   *
   * @returns Wether chaining is enabled
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getChaining(): Promise<Profile["chaining"]> {
    console.log("Getting profile chaining.");

    await this.goto(this.editAccountUrl.href, true);
    const { input } = await this.getChainingElement();
    return await input.checked;
  }

  /**
   * Gets the gender of the currently logged in user.
   *
   * @returns The gender of the currently logged in user
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getGender(): Promise<Profile["gender"]> {
    console.log("Getting profile gender.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getGenderElement();
    return <Profile["gender"]>String(await input.value);
  }

  /**
   * Gets the phone number of the currently logged in user.
   *
   * @returns The phone number of the currently logged in userq
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getPhoneNo(): Promise<Profile["phoneNo"]> {
    console.log("Getting profile phone number.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getPhoneNoElement();
    return String(await input.value);
  }

  /**
   * Gets the email of the currently logged in user.
   *
   * @returns The email of the currently logged in user
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getEmail(): Promise<Profile["email"]> {
    console.log("Getting profile email.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getEmailElement();
    return String(await input.value);
  }

  /**
   * Gets the bio of the currently logged in user.
   *
   * @returns The bio of the currently logged in user
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getBio(): Promise<Profile["bio"]> {
    console.log("Getting profile bio.");

    await this.goto(this.editAccountUrl.href, true);
    const textarea = await this.getBioElement();
    return String(await textarea.value);
  }

  /**
   * Gets the website of the currently logged in user.
   *
   * @returns The website of the currently logged in user
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getWebsite(): Promise<Profile["website"]> {
    console.log("Getting profile website.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getWebsiteElement();
    return String(await input.value);
  }

  /**
   * Gets the name of the currently logged in user.
   *
   * This is the name that is displayed on the profile, not the username.
   *
   * @returns The name of the currently logged in user
   */
  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  async getName(): Promise<Profile["name"]> {
    console.log("Getting profile name.");

    await this.goto(this.editAccountUrl.href, true);
    const input = await this.getNameElement();
    return String(await input.value);
  }

  /**
   * Gets the username set on this {@link IGBot} instance.
   *
   * @returns `this.username`
   */
  getUsername(): Profile["username"] {
    return this.username;
  }

  /**
   * Gets the password set on this {@link IGBot} instance.
   *
   * @returns `this.password`
   */
  getPassword(): Profile["password"] {
    return this.password;
  }

  //
  // Get Profile Elements Methods
  //

  @needsInit()
  @needsLogin()
  protected async getChainingElement() {
    const input = await this.waitForElement("#pepChainingEnabled input[type='checkbox']");
    const element = await this.waitForElement("#pepChainingEnabled label div");

    return {
      input,
      element,
    };
  }

  protected async getGenderElement() {
    return await this.waitForElement("#pepGender");
  }

  protected async getPhoneNoElement() {
    return await this.waitForElement("[id='pepPhone Number']");
  }

  protected async getEmailElement() {
    return await this.waitForElement("#pepEmail");
  }

  protected async getBioElement() {
    return await this.waitForElement("#pepBio");
  }

  protected async getWebsiteElement() {
    return await this.waitForElement("#pepWebsite");
  }

  protected async getNameElement() {
    return await this.waitForElement("#pepName");
  }

  protected async getUsernameElement() {
    return await this.waitForElement("#pepUsername");
  }

  @needsFree()
  @needsInit()
  @needsLogin()
  @makesBusy()
  protected async declineOnetapLogin() {
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
  protected async declineNotifications() {
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
  protected async acceptCookieConsent() {
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
  protected async getMessageToast(timeToWaitMs = 1e3): Promise<ISuperHTMLElement | null> {
    const toastMessage = await this.waitForElement(
      "body div > div > div > div > div > p",
      timeToWaitMs,
    ).catch(() => null);

    return toastMessage;
  }

  @needsInit()
  protected async isPageNotFound() {
    return (await this.document.title) === "Page Not Found • Instagram";
  }

  protected async repeatKey(key: ITypeInteraction, count: number) {
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
  @needsInit()
  protected async clearInput() {
    // select all text in input
    await this.hero.interact({ keyDown: KeyboardKey.ControlLeft }, { keyDown: KeyboardKey.A });
    await this.hero.interact({ keyUp: KeyboardKey.A }, { keyUp: KeyboardKey.ControlLeft });

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

  protected getUrl(path: string) {
    return new URL(path, this.baseInstagramUrl.origin);
  }

  protected getHref(path: string) {
    return this.getUrl(path).href;
  }
}
