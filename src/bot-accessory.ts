/* eslint-disable brace-style */
/* eslint-disable prefer-const */
/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  AccessoryPlugin,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
  CharacteristicEventTypes,
} from "homebridge";
import { rejects } from "assert";

export class Bot implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly bleMac: string;
  private readonly scanDuration: number;
  private readonly switchbot: any;

  private switchOn = false;
  private runTimer!: NodeJS.Timeout;

  // This property must be existent!!
  name: string;

  private readonly botService: Service;
  private readonly informationService: Service;

  constructor(hap: HAP, log: Logging, name: string, bleMac: string, scanDuration: number) {
    this.log = log;
    this.name = name;
    this.bleMac = bleMac;
    this.scanDuration = scanDuration;
    const SwitchBot = require("node-switchbot");
    this.switchbot = new SwitchBot();

    this.botService = new hap.Service.Switch(name);
    this.botService
      .getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Current state of Bot was returned: " + (this.switchOn ? "ON" : "OFF"));
        callback(undefined, this.switchOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const targetState = value as boolean;
        clearTimeout(this.runTimer);
        if (targetState === this.switchOn) {
          log.info("Target state of Bot has not changed: " + (this.switchOn ? "ON" : "OFF"));
          this.botService?.getCharacteristic(hap.Characteristic.On).updateValue(this.switchOn);
          callback();
        }
        // Target state has been changed.
        log.info("Target state of Bot setting: " + (targetState ? "ON" : "OFF"));
        this.switchbot
          .discover({ duration: this.scanDuration, model: "H", quick: true, id: this.bleMac })
          .then((device_list: any) => {
            log.info("Scan done.");
            let targetDevice: any = null;
            for (let device of device_list) {
              // log.info(device.modelName, device.address);
              if (device.address == this.bleMac) {
                targetDevice = device;
                break;
              }
            }
            if (!targetDevice) {
              log.info("No device was found during scan.");
              return new Promise((resolve, reject) => {
                reject(new Error("No device was found during scan."));
              });
            } else {
              log.info(targetDevice.modelName + " (" + targetDevice.address + ") was found.");
              // Set event handers
              targetDevice.onconnect = () => {
                // log.info('Connected.');
              };
              targetDevice.ondisconnect = () => {
                // log.info('Disconnected.');
              };
              log.info("Bot is running...");
              return this.setTargetDeviceState(targetDevice, targetState);
            }
          })
          .then(() => {
            log.info("Done.");
            this.switchOn = targetState;
            this.runTimer = setTimeout(() => {
              this.botService?.getCharacteristic(hap.Characteristic.On).updateValue(this.switchOn);
            }, 500);
            log.info("Bot state has been set to: " + (this.switchOn ? "ON" : "OFF"));
            callback();
          })
          .catch((error: any) => {
            log.error(error);
            this.runTimer = setTimeout(() => {
              this.botService?.getCharacteristic(hap.Characteristic.On).updateValue(this.switchOn);
            }, 500);
            log.info("Bot state failed to be set to: " + (targetState ? "ON" : "OFF"));
            callback();
          });
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "SwitchBot")
      .setCharacteristic(hap.Characteristic.Model, "SWITCHBOT-S1")
      .setCharacteristic(hap.Characteristic.SerialNumber, this.bleMac);

    log.info("Bot '%s' created!", name);
  }

  async retry(max: number, fn: Function): Promise<null> {
    return fn().catch( async (err: any) => {
      if (max == 0) {
        throw err;
      }
      this.log.info(err);
      this.log.info("Retrying");
      await this.switchbot.wait(1000);
      return this.retry(max - 1, fn);
    });
  }

  async setTargetDeviceState(targetDevice: any, targetState: boolean): Promise<null> {
    return await this.retry(5, () => {
      if (targetState) {
        return targetDevice.turnOn();
      } else {
        return targetDevice.turnOff();
      }
    });
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log.info("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [this.informationService, this.botService];
  }
}
