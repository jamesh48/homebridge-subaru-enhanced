import type {
  API,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { SubaruApi } from './util/api.js';
import { SubaruPluginService } from './services/SubaruPluginService.js';
import { LockMechanismService } from './services/LockMechanismService.js';
import { RemoteStartService } from './services/RemoteStartService.js';
import { RemoteStopService } from './services/RemoteStopService.js';

let hap: HAP;

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  hap = api.hap;
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SubaruPlatform);
};

class SubaruPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly config: PlatformConfig;
  private readonly api: API;
  private readonly accessories: PlatformAccessory[] = [];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;

    this.log.info('SubaruPlatform initialized');

    // When this event is fired, homebridge restored all cached accessories from disk
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discover and register accessories
   */
  discoverDevices() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = this.config as any;

    // Generate a unique id for the accessory
    const uuid = this.api.hap.uuid.generate(config.name || 'Subaru');

    // Check if accessory already exists
    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid,
    );

    if (existingAccessory) {
      // Update the accessory
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
      new SubaruAccessory(this, existingAccessory);
    } else {
      // Create new accessory
      this.log.info('Adding new accessory:', config.name || 'Subaru');
      const accessory = new this.api.platformAccessory(
        config.name || 'Subaru',
        uuid,
      );

      // Store config in context
      accessory.context.config = config;

      new SubaruAccessory(this, accessory);

      // Register the accessory
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory,
      ]);
    }
  }
}

class SubaruAccessory {
  private readonly platform: SubaruPlatform;
  private readonly accessory: PlatformAccessory;
  private readonly subaru: SubaruApi;
  private readonly services: SubaruPluginService[] = [];

  constructor(platform: SubaruPlatform, accessory: PlatformAccessory) {
    this.platform = platform;
    this.accessory = accessory;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const platformAny = platform as any;
    const config = accessory.context.config || platformAny.config;
    this.subaru = new SubaruApi(platformAny.log, config);

    platformAny.log.info('SubaruAccessory initialized successfully');

    // Set accessory information
    this.accessory
      .getService(hap.Service.AccessoryInformation)!
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Subaru')
      .setCharacteristic(hap.Characteristic.Model, 'Starlink')
      .setCharacteristic(
        hap.Characteristic.SerialNumber,
        config.deviceId || 'Unknown',
      );

    // Initialize services
    const context = {
      log: platformAny.log,
      hap,
      config,
      subaru: this.subaru,
      accessory: this.accessory,
    };

    // Services will get or create themselves on the accessory
    this.services.push(new LockMechanismService(context));
    this.services.push(new RemoteStartService(context));
    this.services.push(new RemoteStopService(context));
  }
}
