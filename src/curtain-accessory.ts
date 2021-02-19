/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable eqeqeq */
/* eslint-disable prefer-const */
/* eslint-disable brace-style */
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

export class Curtain implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly bleMac: string;
  private readonly scanDuration: number;
  private readonly reverseDir: boolean;
  private readonly moveTime: number;

  private currentPosition = 0;
  private targetPosition = 0;
  private positionState = 0;
  private moveTimer!: NodeJS.Timeout;

  // This property must be existent!!
  name: string;

  private readonly curtainService: Service;
  private readonly informationService: Service;

  constructor(hap: HAP, log: Logging, name: string, bleMac: string, scanDuration: number, reverseDir: boolean, moveTime: number) {
    this.log = log;
    this.name = name;
    this.bleMac = bleMac;
    this.scanDuration = scanDuration;
    this.reverseDir = reverseDir;
    this.moveTime = moveTime;

    this.positionState = hap.Characteristic.PositionState.STOPPED;

    this.curtainService = new hap.Service.WindowCovering(name);
    this.curtainService
      .getCharacteristic(hap.Characteristic.CurrentPosition)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Current position of Curtain was returned: " + this.currentPosition + "%");
        callback(undefined, this.currentPosition);
      });

    this.curtainService
      .getCharacteristic(hap.Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Target position of Curtain was returned: " + this.targetPosition + "%");
        callback(undefined, this.targetPosition);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.targetPosition = value as number;
        log.info("Target position of Curtain setting: " + this.targetPosition + "%");
        clearTimeout(this.moveTimer);
        if (this.targetPosition > this.currentPosition) {
          this.positionState = hap.Characteristic.PositionState.INCREASING;
        } else if (this.targetPosition < this.currentPosition) {
          this.positionState = hap.Characteristic.PositionState.DECREASING;
        } else {
          this.positionState = hap.Characteristic.PositionState.STOPPED;
        }

        if (this.positionState === hap.Characteristic.PositionState.STOPPED) {
          this.curtainService?.getCharacteristic(hap.Characteristic.TargetPosition).updateValue(this.targetPosition);
          this.curtainService?.getCharacteristic(hap.Characteristic.CurrentPosition).updateValue(this.currentPosition);
          this.curtainService?.getCharacteristic(hap.Characteristic.PositionState).updateValue(this.positionState);
          callback();
        } else {
          const SwitchBot = require("node-switchbot");
          const switchbot = new SwitchBot();
          switchbot
            .discover({ duration: this.scanDuration, model: "c", quick: false })
            .then((device_list: any) => {
              log.info("Scan done.");
              let targetDevice: any = null;
              for (let device of device_list) {
                log.info(device.modelName, device.address);
                if (device.address == this.bleMac) {
                  targetDevice = device;
                  break;
                }
              }
              if (!targetDevice) {
                log.info(name + " (" + bleMac + ") was not found.");
                return new Promise((resolve, reject) => {
                  reject(new Error("No target device was found."));
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
                log.info("Curtain is moving...");
                /**opend - 0% in HomeKit, 100% in Curtain device.
                 * closed - 100% in HomeKit, 0% in Curtain device.
                 * To keep the status synchronized, convert the percentage of homekit to the percentage of Curtain.
                 */
                let covertToDevicePosition = 0;
                if (!reverseDir) {
                  covertToDevicePosition = 100 - this.targetPosition;
                } else {
                  log.info('Reverse the "opened" and "closed" directions!');
                  covertToDevicePosition = this.targetPosition;
                }
                return targetDevice.runToPos(covertToDevicePosition);
              }
            })
            .then(() => {
              log.info("Done.");
              log.info("Target position of Curtain has been set to: " + this.targetPosition + "%");
              this.moveTimer = setTimeout(() => {
                // log.info("setTimeout", this.positionState.toString(), this.currentPosition.toString(), this.targetPosition.toString());
                this.currentPosition = this.targetPosition;
                this.positionState = hap.Characteristic.PositionState.STOPPED;
                // this.curtainService?.getCharacteristic(hap.Characteristic.TargetPosition).updateValue(this.targetPosition);
                this.curtainService?.getCharacteristic(hap.Characteristic.CurrentPosition).updateValue(this.currentPosition);
                this.curtainService?.getCharacteristic(hap.Characteristic.PositionState).updateValue(this.positionState);
              }, this.moveTime);
              callback();
            })
            .catch((error: any) => {
              log.error(error);
              this.moveTimer = setTimeout(() => {
                this.targetPosition = this.currentPosition;
                this.positionState = hap.Characteristic.PositionState.STOPPED;
                this.curtainService?.getCharacteristic(hap.Characteristic.TargetPosition).updateValue(this.targetPosition);
                // this.curtainService?.getCharacteristic(hap.Characteristic.CurrentPosition).updateValue(this.currentPosition);
                this.curtainService?.getCharacteristic(hap.Characteristic.PositionState).updateValue(this.positionState);
              }, 1000);
              log.info("Target position of Curtain failed to be set to: " + this.targetPosition + "%");
              callback();
            });
        }
      });

    this.curtainService
      .getCharacteristic(hap.Characteristic.PositionState)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("The position state of Curtain was returned: " + this.positionState);
        callback(undefined, this.positionState);
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "SwitchBot")
      .setCharacteristic(hap.Characteristic.Model, "SWITCHBOT-CURTAIN-W0701600")
      .setCharacteristic(hap.Characteristic.SerialNumber, this.bleMac);

    log.info("Curtain '%s' created!", name);
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
    return [this.informationService, this.curtainService];
  }
}
