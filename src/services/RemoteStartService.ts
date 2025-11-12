import { Service } from "homebridge";
import { SubaruPluginService, SubaruPluginServiceContext } from "./SubaruPluginService.js";

export class RemoteStartService extends SubaruPluginService {
  public service: Service;

  constructor(context: SubaruPluginServiceContext) {
    super(context);

    const { hap } = context;

    this.service = new hap.Service.Switch(
      this.serviceName("Remote Start"),
      "remote-start",
    );

    this.service.setCharacteristic(hap.Characteristic.ConfiguredName, this.serviceName("Remote Start"));

    this.service
      .getCharacteristic(hap.Characteristic.On)
      .onGet(() => {
        // Always return false (off state) since these are momentary buttons
        return false;
      })
      .onSet(async (value) => {
        if (value) {
          await this.remoteStart();
          // Turn the switch back off after a brief delay
          setTimeout(() => {
            this.service.getCharacteristic(hap.Characteristic.On).updateValue(false);
          }, 1000);
        }
      });
  }

  /**
   * Locks the vehicle
   */
  private async remoteStart(): Promise<void> {
    const { subaru, log } = this.context;
    try {
      log.info("Remote Starting Vehicle");
      await subaru.remoteStartVehicle();
      log.info("Vehicle Started Remotely");
    } catch (error) {
      log.error("Failed to remotely start vehicle:", error);
      throw error;
    }
  }
}
