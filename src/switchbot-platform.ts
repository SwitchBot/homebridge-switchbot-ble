import { AccessoryPlugin, API, HAP, Logging, PlatformConfig, StaticPlatformPlugin, } from "homebridge";
import { Bot } from "./bot-accessory";
import { Curtain } from "./curtain-accessory";
import { Meter } from "./meter-accessory";
import { Humidifier } from "./humidifier-accessory";
import { off } from "process";

const PLATFORM_NAME = "SwitchBotPlatform";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

export = (api: API) => {
  hap = api.hap;

  api.registerPlatform(PLATFORM_NAME, SwitchBotPlatform);
};

class SwitchBotPlatform implements StaticPlatformPlugin {

  private readonly log: Logging;
  private readonly config: PlatformConfig;

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;

    // probably parse config or something here
    this.config = config;

    log.info("SwitchBot platform finished initializing!");
  }

  /*
   * This method is called to retrieve all accessories exposed by the platform.
   * The Platform can delay the response my invoking the callback at a later time,
   * it will delay the bridge startup though, so keep it to a minimum.
   * The set of exposed accessories CANNOT change over the lifetime of the plugin!
   */
  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    let deviceList = [];
    if (this.config.devices) {
    for (var device of this.config.devices) {
      // this.log.info(device.type);
      // this.log.info(device.name);
      // this.log.info(device.bleMac);
      // this.log.info(device.scanDuration, typeof device.scanDuration);
      let scanDuration: number = device.scanDuration || 1000;
      switch (device.type) {
        case 'bot':
          deviceList.push(new Bot(hap, this.log, device.name, device.bleMac.toLowerCase(), scanDuration));
          break;
        case 'humidifier':
          deviceList.push(new Humidifier(hap, this.log, device.name, device.bleMac.toLowerCase(), scanDuration));
          break;
        case 'curtain':
          const reverseDir: boolean = device.reverseDir || false;
          const moveTime: number = device.moveTime || 2000;
          deviceList.push(new Curtain(hap, this.log, device.name, device.bleMac.toLowerCase(), scanDuration, reverseDir, moveTime));
          break;
        case 'meter':
          let scanInterval: number = device.scanInterval || 60000;
          if (scanInterval < scanDuration) {
            scanInterval = scanDuration + 1000;
          }
          deviceList.push(new Meter(hap, this.log, device.name, device.bleMac.toLowerCase(), scanDuration, scanInterval));
          break;
        default:
          break;
      }
    }
  } else {
    this.log.error('No Device Set In Config')
  }
    this.log("Device amount:", deviceList.length.toString());
    callback(deviceList);
  }
}
