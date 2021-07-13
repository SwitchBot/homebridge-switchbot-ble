# Changelog

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/)

## [Version 1.3.0](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases/tag/v1.3.0) (2021-07-13)

### Changes

- Add retry support to address disconnects.
- House Keeping and Update dependencies.

## [Version 1.2.10](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2021-02-19)

### Changes

- House Keeping and Update dependencies.

## [Version 1.2.9](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2021-01-21)

### Changes

- Fixed issues from `v1.2.8`.

## [Version 1.2.8](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2021-01-21)

### Changes

- Update Dependencies
  - Node-SwitchBot v1.0.0
    - Fix for "No device was found" in MacOS

## [Version 1.2.7](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-12-22)

### Changes

- Fixed issues from `v1.2.6`.

## [Version 1.2.6](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-12-21)

### Changes

- Fixed issue with `config.schema.json` not being packaged in `v1.2.4`.
- Update dependencies.

## [Version 1.2.5](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-12-21)

### Changes

- Fixed issue with `config.schema.json` not being packaged in `v1.2.4`.
- Update Dependencies.

## [Version 1.2.4](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-12-21)

### Changes

- Support Homebridge config setting UI. (Thanks to [@donavanbecker](https://github.com/SwitchBot/homebridge-switchbot-ble/pull/24))
- Fixed TypeError: this.config.devices is not iterable. (Thanks to [@donavanbecker](https://github.com/SwitchBot/homebridge-switchbot-ble/pull/23))

## [Version 1.2.3](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-11-30)

### Changes

- Fixed the incorrect state of Bot in Home App when control fails.
- Modify log messages. (Thanks to [@dnicolson](https://github.com/SwitchBot/homebridge-switchbot-ble/pull/15))

## [Version 1.2.2](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-11-19)

### Changes

- Fixed Curtain state will not be updated in the Home App.

## [Version 1.2.1](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-11-12)

### Changes

- Get temperature and humidity from Meter advertising periodically.

## [Version 1.2.0](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-11-06)

### Changes

- Fixed HomeKit control direction reversal issue.
- Add option for inverted curtain position. (Thanks to [@whatUwant](https://github.com/SwitchBot/homebridge-switchbot-ble/pull/4))

## [Version 1.1.0](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-10-29)

### Changes

- Add support for Curtain.

## [Version 1.0.1](https://github.com/OpenWonderLabs/homebridge-switchbot-ble/releases) (2020-10-22)

### Changes

- First public release, supports Bot.
