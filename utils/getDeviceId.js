import { v4 as uuidv4 } from "uuid";

export function getOrCreateDeviceId(req) {
  let deviceId = req.cookies?.deviceId || req.headers["x-device-id"];

  if (!deviceId) {
    deviceId = uuidv4();
  }

  return deviceId;
}
