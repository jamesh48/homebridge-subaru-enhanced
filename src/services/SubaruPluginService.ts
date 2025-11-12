import {
  CharacteristicValue,
  HAP,
  HAPStatus,
  Logging,
  Nullable,
  Service,
} from 'homebridge';
import { SubaruApi } from '../util/api';
import { SubaruPluginConfig } from '../util/types';

export type SubaruPluginServiceContext = {
  log: Logging;
  hap: HAP;
  config: SubaruPluginConfig;
  subaru: SubaruApi;
};

export abstract class SubaruPluginService {
  protected context: SubaruPluginServiceContext;
  public abstract service: Service;

  constructor(context: SubaruPluginServiceContext) {
    this.context = context;
  }

  /**
   * Optional method to return multiple services.
   * If not implemented, the platform will use the primary 'service' property.
   */
  public getServices?(): Service[];

  protected serviceName(name: string): string {
    const { config } = this.context;

    // Optional prefix to prepend to all accessory names.
    const prefix = (config.prefix ?? '').trim();

    this.context.log(`${prefix} ${name}`);

    if (prefix.length > 0) {
      return `${prefix} ${name}`;
    } else {
      return name;
    }
  }

  //
  // Typesafe callbackify.
  //

  protected createSetter<T extends CharacteristicValue>(
    setter: Setter<T>,
  ): SetterCallback {
    return (value, callback) => {
      setter
        .call(this, value as T)
        .then((writeResponse) => callback(null, writeResponse ?? undefined))
        .catch((error: Error) => callback(error));
    };
  }
}

type Setter<T extends CharacteristicValue> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  this: any,
  value: T,
) => Promise<Nullable<T> | void>;

type SetterCallback = (
  value: CharacteristicValue,
  callback: (
    error?: HAPStatus | Error | null,
    writeResponse?: Nullable<CharacteristicValue>,
  ) => void,
) => void;
