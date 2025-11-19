import type { AccessoryConfig, API, HAP, Logging } from 'homebridge';

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
  api.registerAccessory(
    'homebridge-subaru-enhanced',
    'HomebridgeSubaruEnhanced',
    SubaruAccessory,
  );
};

class SubaruAccessory {
  log: Logging;
  name: string;
  subaru: SubaruApi;
  services: SubaruPluginService[] = [];

  constructor(log: Logging, untypedConfig: AccessoryConfig) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = untypedConfig as any;
    const subaru = new SubaruApi(log, config);

    this.log = log;
    this.name = 'Subaru';
    this.subaru = subaru;

    log.info('SubaruAccessory initialized successfully');

    // Initialize services
    const context = { log, hap, config, subaru };
    this.services.push(new LockMechanismService(context));
    this.services.push(new RemoteStartService(context));
    this.services.push(new RemoteStopService(context));
  }
  getServices() {
    return this.services.flatMap((service) => {
      // If the service has a getServices() method, use it to get all services
      if (typeof service.getServices === 'function') {
        return service.getServices();
      }
      // Otherwise, just return the primary service
      return service.service;
    });
  }
}
