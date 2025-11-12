import { Logging } from "homebridge";
import { EventEmitter } from "./events.js";
import { SubaruPluginConfig, TSubaruRemoteCommandResponse } from "./types.js";
import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export interface SubaruApiEvents {}

export class SubaruApi extends EventEmitter<SubaruApiEvents> {
  private log: Logging;
  private config: SubaruPluginConfig;
  private axiosInstance: AxiosInstance;
  private cookieJar: CookieJar;
  private isAuthenticated: boolean = false;

  constructor(log: Logging, config: SubaruPluginConfig) {
    super();
    this.log = log;
    this.config = config;

    // Create cookie jar for session management
    this.cookieJar = new CookieJar();

    // Create axios instance with cookie support
    this.axiosInstance = wrapper(
      axios.create({
        jar: this.cookieJar,
        withCredentials: true,
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }),
    );
  }

  private async login(retryCount: number = 0): Promise<void> {
    const MAX_RETRIES = 2;

    if (this.isAuthenticated) {
      return;
    }

    try {
      // Step 1: GET the login page to establish session cookies
      this.log.info("Getting login page to establish session...");
      await this.axiosInstance.get("https://www.mysubaru.com/login");

      // Step 2: POST login credentials with the session cookies
      this.log.info("Submitting login credentials...");
      const bodyFormData = new URLSearchParams();
      bodyFormData.append("username", this.config.username);
      bodyFormData.append("password", this.config.password);
      bodyFormData.append("lastSelectedVehicleKey", this.config.lastSelectedVehicleKey || "");
      bodyFormData.append("deviceId", this.config.deviceId || "");

      const response = await this.axiosInstance.post(
        "https://www.mysubaru.com/login",
        bodyFormData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://www.mysubaru.com/login",
            Origin: "https://www.mysubaru.com",
          },
          maxRedirects: 0, // Don't follow redirects automatically so we can check for success
          validateStatus: (status) => status === 302 || status === 200, // Accept both redirect and OK
        },
      );

      // Check if login was successful (should get 302 redirect)
      if (response.status === 302) {
        this.log.info("Successfully logged in! (Got 302 redirect)");
        this.isAuthenticated = true;
      } else if (response.status === 200) {
        // Got 200 = returned login page, likely session expired
        this.log.warn(
          `Got 200 response (login page) - session may have expired. Retry ${
            retryCount + 1
          }/${MAX_RETRIES}`,
        );
        this.isAuthenticated = false;

        if (retryCount < MAX_RETRIES) {
          return this.login(retryCount + 1);
        } else {
          throw new Error(
            "Login failed: Got 200 response after max retries. Check credentials or session handling.",
          );
        }
      }
    } catch (err: any) {
      if (err.response?.status === 302) {
        // 302 is actually success, axios threw because of maxRedirects: 0
        this.log.info("Successfully logged in! (Got 302 redirect via error)");
        this.isAuthenticated = true;

        // Follow the redirect
        const redirectUrl = err.response.headers.location;
        if (redirectUrl) {
          const fullUrl = redirectUrl.startsWith("http")
            ? redirectUrl
            : `https://www.mysubaru.com${redirectUrl}`;
          await this.axiosInstance.get(fullUrl);
        }
      } else {
        this.log.error("Login failed:", err.message);
        throw err;
      }
    }
  }

  public async lock(): Promise<void> {
    this.log.info("Locking vehicle...");

    try {
      // First, ensure we're logged in
      await this.login();

      const now = Date.now();
      let bodyFormData = new URLSearchParams();

      bodyFormData.append("now", now.toString());
      bodyFormData.append("pin", this.config.pin);
      bodyFormData.append("delay", "0");
      bodyFormData.append("horn", "true");
      bodyFormData.append("lockDoorType", "ALL_DOORS_CMD");

      const { data } = await this.axiosInstance.post<TSubaruRemoteCommandResponse<"lock">>(
        "https://www.mysubaru.com/service/g2/lock/execute.json",
        bodyFormData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://www.mysubaru.com/",
          },
        },
      );

      this.log.info("Lock command response:", JSON.stringify(data));
    } catch (err: any) {
      this.log.error("Lock failed:", err.message);
      if (err.response) {
        this.log.error("Response status:", err.response.status);
        this.log.error("Response data:", JSON.stringify(err.response.data));
      }
      throw err;
    }
  }

  public async unlock(): Promise<void> {
    this.log.info("Unlocking vehicle...");

    try {
      // First, ensure we're logged in
      await this.login();

      const now = Date.now();
      let bodyFormData = new URLSearchParams();

      bodyFormData.append("now", now.toString());
      bodyFormData.append("pin", this.config.pin);
      bodyFormData.append("delay", "0");
      bodyFormData.append("horn", "true");
      bodyFormData.append("unlockDoorType", "ALL_DOORS_CMD");

      const { data } = await this.axiosInstance.post<TSubaruRemoteCommandResponse<"unlock">>(
        "https://www.mysubaru.com/service/g2/unlock/execute.json",
        bodyFormData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://www.mysubaru.com/",
          },
        },
      );

      this.log.info("Unlock command response:", JSON.stringify(data));
    } catch (err: any) {
      this.log.error("Unlock failed:", err.message);
      if (err.response) {
        this.log.error("Response status:", err.response.status);
        this.log.error("Response data:", JSON.stringify(err.response.data));
      }
      throw err;
    }
  }


  public async remoteStartVehicle(): Promise<void> {
    this.log.info("Remote Starting Vehicle...");

    try {
      // First, ensure we're logged in
      await this.login();

      const now = Date.now();
      const bodyFormData = new URLSearchParams();
      const preset = this.config.remoteStartPresets || "Heat";

      // Configure parameters based on preset mode
      let presetConfig: {
        name: string;
        temp: string;
        airMode: string;
        airVolume: string;
        acOn: string;
        heatedSeats: string;
        rearDefrost: string;
      };

      switch (preset.toLowerCase()) {
        case "defrost":
          presetConfig = {
            name: "Defrost",
            temp: "85",
            airMode: "FEET_WINDOW",
            airVolume: "7",
            acOn: "false",
            heatedSeats: "MEDIUM_HEAT",
            rearDefrost: "true",
          };
          break;
        case "heat":
          presetConfig = {
            name: "Heat",
            temp: "75",
            airMode: "feet_face_balanced",
            airVolume: "6",
            acOn: "false",
            heatedSeats: "HIGH_HEAT",
            rearDefrost: "false",
          };
          break;
        case "cool":
          presetConfig = {
            name: "Cool",
            temp: "60",
            airMode: "feet_face_balanced",
            airVolume: "7",
            acOn: "true",
            heatedSeats: "OFF",
            rearDefrost: "false",
          };
          break;
        default:
          // Default to heat if invalid preset
          presetConfig = {
            name: "Heat",
            temp: "75",
            airMode: "feet_face_balanced",
            airVolume: "6",
            acOn: "false",
            heatedSeats: "HIGH_HEAT",
            rearDefrost: "false",
          };
      }

      this.log.info(`Using ${presetConfig.name} preset for remote start`);

      const horn = this.config.horn ?? true;
      const runTimeMinutes = this.config.runTimeMinutes ?? 10;
      const delay = this.config.delay ?? 0;

      bodyFormData.append("now", now.toString());
      bodyFormData.append("pin", this.config.pin);
      bodyFormData.append("delay", delay.toString());
      bodyFormData.append("horn", horn.toString());
      bodyFormData.append("unlockDoorType", "ALL_DOORS_CMD");
      bodyFormData.append("name", presetConfig.name);
      bodyFormData.append("runTimeMinutes", runTimeMinutes.toString());
      bodyFormData.append("climateZoneFrontTemp", presetConfig.temp);
      bodyFormData.append("climateZoneFrontAirMode", presetConfig.airMode);
      bodyFormData.append("climateZoneFrontAirVolume", presetConfig.airVolume);
      bodyFormData.append("airConditionOn", presetConfig.acOn);
      bodyFormData.append("heatedSeatFrontLeft", presetConfig.heatedSeats);
      bodyFormData.append("heatedSeatFrontRight", presetConfig.heatedSeats);
      bodyFormData.append("heatedRearWindowActive", presetConfig.rearDefrost);
      bodyFormData.append("outerAirCirculation", "outsideAir");
      bodyFormData.append("startConfiguration", "START_ENGINE_ALLOW_KEY_IN_IGNITION");
      bodyFormData.append("canEdit", "false");
      bodyFormData.append("disabled", "true");
      bodyFormData.append("vehicleType", "gas");
      bodyFormData.append("presetType", "subaruPreset");

      const { data } = await this.axiosInstance.post<TSubaruRemoteCommandResponse<"engineStart">>(
        "https://www.mysubaru.com/service/g2/engineStart/execute.json",
        bodyFormData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://www.mysubaru.com/",
          },
        },
      );

      this.log.info("Remote start command response:", JSON.stringify(data));
    } catch (err: any) {
      this.log.error("Remote start failed:", err.message);
      if (err.response) {
        this.log.error("Response status:", err.response.status);
        this.log.error("Response data:", JSON.stringify(err.response.data));
      }
      throw err;
    }
  }

  public async remoteStopVehicle(): Promise<void> {
    this.log.info("Remote Stopping Vehicle...");

    try {
      // First, ensure we're logged in
      await this.login();

      const now = Date.now();
      let bodyFormData = new URLSearchParams();

      bodyFormData.append("now", now.toString());
      bodyFormData.append("pin", this.config.pin);
      bodyFormData.append("delay", "0");
      bodyFormData.append("horn", "true");
      bodyFormData.append("unlockDoorType", "ALL_DOORS_CMD");

      const { data } = await this.axiosInstance.post<TSubaruRemoteCommandResponse<"engineStop">>(
        "https://www.mysubaru.com/service/g2/engineStop/execute.json",
        bodyFormData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: "https://www.mysubaru.com/",
          },
        },
      );

      this.log.info("Remote stop command response:", JSON.stringify(data));
    } catch (err: any) {
      this.log.error("Remote stop failed:", err.message);
      if (err.response) {
        this.log.error("Response status:", err.response.status);
        this.log.error("Response data:", JSON.stringify(err.response.data));
      }
      throw err;
    }
  }
}
