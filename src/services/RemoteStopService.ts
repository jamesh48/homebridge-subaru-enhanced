import { Service } from 'homebridge';
import {
  SubaruPluginService,
  SubaruPluginServiceContext,
} from './SubaruPluginService.js';

export class RemoteStopService extends SubaruPluginService {
  public service: Service;

  constructor(context: SubaruPluginServiceContext) {
    super(context);

    const { hap, accessory } = context;

    // Get or create the service
    this.service =
      accessory.getServiceById(hap.Service.Switch, 'remote-stop') ||
      accessory.addService(
        new hap.Service.Switch(this.serviceName('Remote Stop'), 'remote-stop'),
      );

    this.service.setCharacteristic(
      hap.Characteristic.ConfiguredName,
      this.serviceName('Remote Stop'),
    );

    this.service
      .getCharacteristic(hap.Characteristic.On)
      .onGet(() => {
        // Always return false (off state) since these are momentary buttons
        return false;
      })
      .onSet(async (value) => {
        if (value) {
          await this.remoteStop();
          // Turn the switch back off after a brief delay
          setTimeout(() => {
            this.service
              .getCharacteristic(hap.Characteristic.On)
              .updateValue(false);
          }, 1000);
        }
      });
  }

  /**
   * Stops the vehicle remotely
   */
  private async remoteStop(): Promise<void> {
    const { subaru, log } = this.context;
    try {
      log.info('Remote Stopping Vehicle');
      await subaru.remoteStopVehicle();
      log.info('Vehicle Stopped Remotely');
    } catch (error) {
      log.error('Failed to remotely stop vehicle:', error);
      throw error;
    }
  }
}
