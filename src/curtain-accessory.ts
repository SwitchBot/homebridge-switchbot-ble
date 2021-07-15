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
  CharacteristicEventTypes, Characteristic,
} from "homebridge";

type OnPositionReceived = (pos: number) => void

class Device {
  private readonly bleMac: string;
  private readonly scanDuration: number;
  private readonly slowScanInterval: number;
  private readonly fastScanInterval = 500;
  private readonly fastScanDuration = 10000;

  private readonly name: string;
  private readonly log: Logging;
  private readonly callback: OnPositionReceived;
  private readonly considerClosedAtPosition = 98;

  private fastScanEnabled = false;
  private autoDisableFastScanTimeoutId: NodeJS.Timeout | null = null;

  private scanIntervalId: NodeJS.Timeout | null = null;

  private previousPosition = -1;
  private position = -1;

  constructor(bleMac: string, name: string, log: Logging, scanDuration: number, scanInterval: number, callback: OnPositionReceived) {
    this.name = name;
    this.bleMac = bleMac;
    this.log = log;

    this.scanDuration = scanDuration;
    this.slowScanInterval = scanInterval;
    this.callback = callback;

    this.startFastScan();
  }

  /**
   * Ask the device to start moving to the given position (which must be a device value and not an HomeKit value).
   * Returns a Promise that's resolved as soon as the command was sent to the device.
   */
  public runToPosition(pos: number): Promise<void> {
    const SwitchBot = require("node-switchbot");
    const switchbot = new SwitchBot();

    return switchbot
      .discover({duration: this.scanDuration, model: "c", quick: false})
      .then((device_list: any) => {
        let targetDevice: any = null;

        for (let device of device_list) {
          this.log.info(device.modelName, device.address);
          if (device.address == this.bleMac) {
            targetDevice = device;
            break;
          }
        }

        if (!targetDevice) {
          return new Promise((resolve, reject) => {
            reject(new Error("Curtain '" + this.name + "' (" + this.bleMac + "): device not found."));
          });
        }

        this.startFastScan();

        this.log.info("Curtain '%s' (%s) is moving to %d%%...", this.name, this.bleMac, pos);
        return targetDevice.runToPos(pos);
      });
  }

  /**
   * Start a faster scan loop (using fastScanInterval). Used in calls to `runToPosition` to
   * report quicker on device position change. Will disable on its own as soon if the curtain's
   * device position does not change for more than `fastScanDuration`.
   */
  private startFastScan() {
    if (this.fastScanEnabled) {
      return;
    }
    this.fastScanEnabled = true;
    this.startScanLoop();
  }

  private stopFastScan() {
    if (!this.fastScanEnabled) {
      return;
    }
    this.fastScanEnabled = false;
    this.startScanLoop();
  }

  private get scanInterval(): number {
    return this.fastScanEnabled ? this.fastScanInterval : this.slowScanInterval;
  }

  private startScanLoop() {
    if (this.scanIntervalId !== null) {
      clearInterval(this.scanIntervalId);
    }

    this.log.info("Curtain '%s': starting scan loop with interval %d", this.name, this.scanInterval);

    this.scanIntervalId = setInterval(() => {
      this.scan().catch((err) => {
        this.log.error("error while scanning for Curtain '%s': %s", this.name, err);
      });
    }, this.scanInterval);
  }

  private scan(): Promise<void> {
    return new Promise((resolve, reject) => {
      const SwitchBot = require("node-switchbot");
      const switchbot = new SwitchBot();
      switchbot.onadvertisement = (ad: any) => {
        this.applyPosition(ad);
      };
      switchbot.startScan({id: this.bleMac})
        .then(() => {
          return switchbot.wait(this.scanDuration);
        })
        .then(() => {
          resolve();
          switchbot.stopScan();
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  private applyPosition(ad: any) {
    let pos = ad.serviceData.position;

    if (pos >= this.considerClosedAtPosition) {
      pos = 100;
    }

    this.previousPosition = this.position;
    this.position = pos;

    if (this.position === this.previousPosition) {
      return;
    }

    if (this.autoDisableFastScanTimeoutId !== null) {
      clearTimeout(this.autoDisableFastScanTimeoutId);
    }

    this.autoDisableFastScanTimeoutId = setTimeout(() => {
      this.stopFastScan();
    }, this.fastScanDuration);

    this.callback(this.position);
  }
}

export class Curtain implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly reverseDir: boolean;
  private readonly moveTime: number;

  private didReceiveInitialPosition = false;

  private currentPosition = 0;
  private targetPosition = 0;
  private positionState = 0;
  private moveTimer!: NodeJS.Timeout;

  private device: Device;

  // This property must be existent!!
  name: string;

  private readonly curtainService: Service;
  private readonly informationService: Service;

  private currentPositionCharacteristic: Characteristic;
  private targetPositionCharacteristic: Characteristic;
  private positionStateCharacteristic: Characteristic;

  constructor(hap: HAP, log: Logging, name: string, bleMac: string, scanDuration: number, reverseDir: boolean, moveTime: number, scanInterval: number) {
    this.log = log;
    this.name = name;
    this.reverseDir = reverseDir;
    this.moveTime = moveTime;

    this.device = new Device(bleMac, name, log, scanDuration, scanInterval, (pos: number) => {
      this.currentPosition = this.convertFromHomeKitPosition(pos);
      this.currentPositionCharacteristic.updateValue(this.currentPosition);

      // Set target to the same value as current on the first received position, or if the curtain is in
      // STOPPED state (eg. it's still or not moving from a change triggered by HomeKit). Otherwise, with
      // target = X and current != X, HomeKit will assume curtain is moving and show the progress indicator.
      //
      // Note that on an HomeKit-triggered change, `positionState` is set to STOPPED after `moveTime` has
      // passed, rather than when the curtain actually finished moving. When `moveTime` is lower than the
      // curtain's actual travel time, the device will appear in HomeKit first as moving (with a progress
      // indicator) then after `moveTime` has passed, as not moving (without progress indicator), but with
      // rapidly changing percentages.
      if (!this.didReceiveInitialPosition || this.positionState === hap.Characteristic.PositionState.STOPPED) {
        this.didReceiveInitialPosition = true;
        this.targetPosition = this.currentPosition;
        this.targetPositionCharacteristic.updateValue(this.targetPosition);
      }
    });

    this.positionState = hap.Characteristic.PositionState.STOPPED;

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "SwitchBot")
      .setCharacteristic(hap.Characteristic.Model, "SWITCHBOT-CURTAIN-W0701600")
      .setCharacteristic(hap.Characteristic.SerialNumber, bleMac);

    this.curtainService = new hap.Service.WindowCovering(name);

    this.currentPositionCharacteristic = this.curtainService
      .getCharacteristic(hap.Characteristic.CurrentPosition);

    this.targetPositionCharacteristic = this.curtainService
      .getCharacteristic(hap.Characteristic.TargetPosition);

    this.positionStateCharacteristic = this.curtainService
      .getCharacteristic(hap.Characteristic.PositionState);

    this.currentPositionCharacteristic
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Current position of Curtain was returned: " + this.currentPosition + "%");
        callback(undefined, this.currentPosition);
      });

    this.targetPositionCharacteristic
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
          this.targetPositionCharacteristic.updateValue(this.targetPosition);
          this.currentPositionCharacteristic.updateValue(this.currentPosition);
          this.positionStateCharacteristic.updateValue(this.positionState);
          callback();
        } else {
          this.device.runToPosition(this.convertFromHomeKitPosition(this.targetPosition))
            .then(() => {
              log.info("Done.");
              log.info("Target position of Curtain has been set to: " + this.targetPosition + "%");
              this.moveTimer = setTimeout(() => {
                // log.info("setTimeout", this.positionState.toString(), this.currentPosition.toString(), this.targetPosition.toString());
                this.positionState = hap.Characteristic.PositionState.STOPPED;
                // this.curtainService?.getCharacteristic(hap.Characteristic.TargetPosition).updateValue(this.targetPosition);
                this.currentPositionCharacteristic.updateValue(this.currentPosition);
                this.positionStateCharacteristic.updateValue(this.positionState);
              }, this.moveTime);
              callback();
            })
            .catch((error: any) => {
              log.error(error);
              this.moveTimer = setTimeout(() => {
                this.targetPosition = this.currentPosition;
                this.positionState = hap.Characteristic.PositionState.STOPPED;
                this.targetPositionCharacteristic.updateValue(this.targetPosition);
                // this.curtainService?.getCharacteristic(hap.Characteristic.CurrentPosition).updateValue(this.currentPosition);
                this.positionStateCharacteristic.updateValue(this.positionState);
              }, 1000);
              log.info("Target position of Curtain failed to be set to: " + this.targetPosition + "%");
              callback();
            });
        }
      });

    this.positionStateCharacteristic
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("The position state of Curtain was returned: " + this.positionState);
        callback(undefined, this.positionState);
      });

    log.info("Curtain '%s' created!", name);
  }


  /**
   * Convert to/from device/HomeKit's position, since:
   *
   * - opened is 0% in HomeKit and 100% in Curtain device.
   * - closed is 100% in HomeKit, 0% in Curtain device.
   */
  convertFromHomeKitPosition(n: number): number {
    let covertToDevicePosition: number;
    if (this.reverseDir) {
      covertToDevicePosition = n;
    } else {
      covertToDevicePosition = 100 - n;
    }
    return covertToDevicePosition;
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
