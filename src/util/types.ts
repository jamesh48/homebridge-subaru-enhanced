import { schema } from '../../config.schema.json';
// Maps the type definition of config.schema.json to an actual TypeScript type.
export type SubaruPluginConfig = {
  [key in keyof typeof schema.properties]: (typeof schema.properties)[key]['default'];
};

export type TSubaruRemoteCommandResponse<
  T extends 'engineStart' | 'engineStop' | 'lock' | 'unlock',
> = {
  success: boolean;
  datName: 'remoteServiceStatus';
  data: {
    serviceRequestId: string;
    success: boolean;
    cancelled: boolean;
    remoteServiceType: T;
    remoteServiceState: 'started';
    vin: string;
  };
};
