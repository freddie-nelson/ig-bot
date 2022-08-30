import Hero from "@ulixee/hero";

export const makesBusy = () => {
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

export const gracefulHeroClose = () => {
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

export const needsInit = createFlagDecorator(
  "getIsInitialised",
  "You must initalize the client before using '$key'.",
);

export const needsLogin = createFlagDecorator(
  "getIsLoggedIn",
  "The client must be logged in before using '$key'.",
);

export const needsFree = createFlagDecorator(
  "getIsFree",
  "The client must be free in order to use '$key'.",
);
