import { Page, Browser, ElementHandle } from "puppeteer";
import puppeteer from "puppeteer-extra";
import { PuppeteerExtraPluginAdblocker } from "puppeteer-extra-plugin-adblocker";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { useXPathLowerCase } from "./utils/useXPathLowerCase";

puppeteer.use(StealthPlugin());
puppeteer.use(new PuppeteerExtraPluginAdblocker({ blockTrackers: true }));

export class Scraper {
  protected browser: Browser;

  protected async findElementWithText(
    page: Page,
    tag: keyof HTMLElementTagNameMap,
    text: string,
    exactMatch = true,
    caseSensitive = false,
  ) {
    let xPath = `//${tag}`;
    if (exactMatch) {
      if (caseSensitive) {
        xPath += `[.='${text}']`;
      } else {
        xPath += `[${useXPathLowerCase()}='${text.toLowerCase()}']`;
      }
    } else {
      if (caseSensitive) {
        xPath += `[contains(., '${text}')]`;
      } else {
        xPath += `[contains(${useXPathLowerCase()}, '${text.toLowerCase()}')]`;
      }
    }

    return await page.waitForXPath(xPath);
  }

  protected async newPage(url: string): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser.newPage();

    const res = await page.goto(url).catch((err) => null);
    if (!res || res.status() >= 400) {
      throw new Error(`Could not reach '${url}', returned status code ${res?.status() || "N/A"}`);
    }

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.resourceType() === "image") {
        req.abort();
      } else {
        req.continue();
      }
    });

    return page;
  }

  protected async launchBrowser() {
    console.log("Launching browser...");
    this.browser = await puppeteer.launch({
      headless: false,
      args: ["--disable-dev-shm-usage"],
    });
    console.log("Browser launched.");
  }

  protected async closeBrowser(browser: Browser) {
    console.log("Closing browser...");
    await browser.close();
    console.log("Browser closed.");
  }

  protected async waitForExecutionContext(page: Page, maxAttempts = 3) {
    const frame = await page.waitForFrame(page.url());
    const context = await frame.executionContext();
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await page.evaluate(() => true);
        return;
      } catch (error) {
        await page.waitForNavigation({ timeout: 5000 });
        attempts++;
      }
    }

    // if reached then max attempts was reached without success, throw
    throw new Error(`Failed while waiting for execution context on '${page.url()}'.`);
  }
}
