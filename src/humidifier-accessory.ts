import {
  AccessoryPlugin,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
  CharacteristicEventTypes
} from "homebridge";
import { rejects } from "assert";

export class Humidifier implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly bleMac: string;
  private readonly scanDuration: number;

  private switchOn = false;
  private runTimer!: NodeJS.Timeout;

  // This property must be existent!!
  name: string;

  private readonly humidifierService: Service;
  private readonly informationService: Service;

  constructor(hap: HAP, log: Logging, name: string, bleMac: string, scanDuration: number) {
    this.log = log;
    this.name = name;
    this.bleMac = bleMac;
    this.scanDuration = scanDuration;

    this.humidifierService = new hap.Service.HumidifierDehumidifier(name);
    this.humidifierService.getCharacteristic(hap.Characteristic.TargetHumidifierDehumidifierState)
      .setProps({ validValues: [0,1] })
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Current state of Humidifier was returned: " + (this.switchOn ? "ON" : "OFF"));
        callback(undefined, this.switchOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const targetState = value as boolean;
        clearTimeout(this.runTimer);
        if (targetState === this.switchOn) {
          log.info("Target state of Humidifier has not changed: " + (this.switchOn ? "ON" : "OFF"));
          this.humidifierService?.getCharacteristic(hap.Characteristic.TargetHumidifierDehumidifierState).updateValue(this.switchOn);
          callback();
        }
        // Target state has been changed.
        log.info("Target state of Humidifier setting: " + (targetState ? "ON" : "OFF"));
        const SwitchBot = require('node-switchbot');
        const switchbot = new SwitchBot();
        switchbot.discover({ duration: this.scanDuration, model: 'H', quick: false }).then((device_list: any) => {
          log.info('Scan done.');
          let targetDevice: any = null;
          for (let device of device_list) {
            // log.info(device.modelName, device.address);
            if (device.address == this.bleMac) {
              targetDevice = device;
              break;
            }
          }
          if (!targetDevice) {
            log.info('No device was found.');
            return new Promise((resolve, reject) => {
              reject(new Error('No device was found.'));
            });
          }
          else {
            log.info(targetDevice.modelName + ' (' + targetDevice.address + ') was found.');
            // Set event handers
            targetDevice.onconnect = () => {
              // log.info('Connected.');
            };
            targetDevice.ondisconnect = () => {
              // log.info('Disconnected.');
            };
            log.info('Humidifier is running...');
            if (targetState) {
              return targetDevice.turnOn();
            }
            else {
              return targetDevice.turnOff();
            }
          }
        }).then(() => {
          log.info('Done.');
          this.switchOn = targetState;
          this.runTimer = setTimeout(() => {
            this.humidifierService?.getCharacteristic(hap.Characteristic.TargetHumidifierDehumidifierState).updateValue(this.switchOn);
          }, 500);
          log.info("Humidifier state has been set to: " + (this.switchOn ? "ON" : "OFF"));
          callback();
        }).catch((error: any) => {
          log.error(error);
          this.runTimer = setTimeout(() => {
            this.humidifierService?.getCharacteristic(hap.Characteristic.TargetHumidifierDehumidifierState).updateValue(this.switchOn);
          }, 500);
          log.info("Humidifier state failed to be set to: " + (targetState ? "ON" : "OFF"));
          callback();
        });
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "SwitchBot")
      .setCharacteristic(hap.Characteristic.Model, "W0801800")
      .setCharacteristic(hap.Characteristic.SerialNumber, this.bleMac);

    log.info("Humidifier '%s' created!", name);
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
    return [
      this.informationService,
      this.humidifierService,
    ];
  }

}
