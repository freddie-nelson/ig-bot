import { ClientPlugin, CorePlugin } from "@ulixee/hero-plugin-utils";
import { IOnClientCommandMeta } from "@ulixee/hero-interfaces/ICorePlugin";
import Hero from "@ulixee/hero";
import { ISendToCoreFn } from "@ulixee/hero-interfaces/IClientPlugin";

export class ClientFileChooserInterceptPlugin extends ClientPlugin {
  static readonly id = "file-chooser-intercept";

  onHero(hero: Hero, sendToCore: ISendToCoreFn) {
    (hero as any).interceptFileChooser = async () => {
      console.log("Sending file-chooser-intercept to core.");
      await sendToCore("file-chooser-intercept");
    };
  }
}

export class CoreFileChooserInterceptPlugin extends CorePlugin {
  static readonly id = "file-chooser-intercept";

  async onClientCommand(meta: IOnClientCommandMeta) {
    return meta.page.devtoolsSession
      .send("Page.setInterceptFileChooserDialog", { enabled: true })
      .catch((err) => err);
  }
}
