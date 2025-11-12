import { Service } from 'homebridge';
import {
  SubaruPluginService,
  SubaruPluginServiceContext,
} from './SubaruPluginService.js';

export class LockMechanismService extends SubaruPluginService {
  public service: Service;
  private lockService: Service;
  private unlockService: Service;

  constructor(context: SubaruPluginServiceContext) {
    super(context);

    const { hap } = context;

    // Create two Switch services - one for Lock and one for Unlock
    this.lockService = new hap.Service.Switch(this.serviceName('Lock'), 'lock');

    this.unlockService = new hap.Service.Switch(
      this.serviceName('Unlock'),
      'unlock',
    );

    this.lockService.setCharacteristic(
      hap.Characteristic.ConfiguredName,
      this.serviceName('Lock'),
    );
    this.unlockService.setCharacteristic(
      hap.Characteristic.ConfiguredName,
      this.serviceName('Unlock'),
    );

    // Set up the Lock button
    this.lockService
      .getCharacteristic(hap.Characteristic.On)
      .onGet(() => {
        // Always return false (off state) since these are momentary buttons
        return false;
      })
      .onSet(async (value) => {
        if (value) {
          await this.lockVehicle();
          // Turn the switch back off after a brief delay
          setTimeout(() => {
            this.lockService
              .getCharacteristic(hap.Characteristic.On)
              .updateValue(false);
          }, 1000);
        }
      });

    // Set up the Unlock button
    this.unlockService
      .getCharacteristic(hap.Characteristic.On)
      .onGet(() => {
        // Always return false (off state) since these are momentary buttons
        return false;
      })
      .onSet(async (value) => {
        if (value) {
          await this.unlockVehicle();
          // Turn the switch back off after a brief delay
          setTimeout(() => {
            this.unlockService
              .getCharacteristic(hap.Characteristic.On)
              .updateValue(false);
          }, 1000);
        }
      });

    // Set the primary service to the lock service
    this.service = this.lockService;
  }

  /**
   * Locks the vehicle
   */
  private async lockVehicle(): Promise<void> {
    const { subaru, log } = this.context;
    try {
      log.info('Locking vehicle');
      await subaru.lock();
      log.info('Vehicle locked successfully');
    } catch (error) {
      log.error('Failed to lock vehicle:', error);
      throw error;
    }
  }

  /**
   * Unlocks the vehicle
   */
  private async unlockVehicle(): Promise<void> {
    const { subaru, log } = this.context;
    try {
      log.info('Unlocking vehicle');
      await subaru.unlock();
      log.info('Vehicle unlocked successfully');
    } catch (error) {
      log.error('Failed to unlock vehicle:', error);
      throw error;
    }
  }

  /**
   * Returns all services for this accessory
   */
  getServices(): Service[] {
    return [this.unlockService, this.lockService];
  }
}
