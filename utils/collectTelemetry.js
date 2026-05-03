import requestIp from "request-ip";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";

export function collectTelemetry(req) {
  // 1. IP Detection
  const detectedIp =
    requestIp.getClientIp(req) ||
    req.ip ||
    req.connection?.remoteAddress ||
    "";

  // Handle X-Forwarded-For manually (if request-ip fails)
  const rawXff = req.headers["x-forwarded-for"];
  let xff;
  if (rawXff) {
    xff = String(rawXff).split(",").map((s) => s.trim())[0];
  }
  
  let clientIp = xff && xff !== "unknown" ? xff : detectedIp;

  // CLEAN THE IP: Remove ::ffff: prefix if present to get standard IPv4
  if (clientIp && clientIp.includes("::ffff:")) {
    clientIp = clientIp.replace("::ffff:", "");
  }

  // 2. User Agent Parsing
  const uaRaw = req.headers["user-agent"] || "";
  const parser = new UAParser(uaRaw);
  const ua = parser.getResult();

  // 3. Device & OS Logic
  const model = req.headers["sec-ch-ua-model"]?.replace(/"/g, "") || ua.device?.model || "Unknown Model";
  const osName = ua.os?.name || "Unknown OS";
  
  let deviceType = "desktop"; 
  if (ua.device?.type === "mobile" || /mobile/i.test(uaRaw)) deviceType = "mobile";
  if (ua.device?.type === "tablet" || /tablet/i.test(uaRaw)) deviceType = "tablet";

  // 4. Geo Location logic
  // FIX: Detect localhost explicitly using the CLEANED IP
  const isLocal = clientIp === "127.0.0.1" || clientIp === "::1";

  // Lookup Geo (Returns null for private/local IPs)
  const geo = geoip.lookup(clientIp);
  let locationString = "Unknown Location";
  if (geo) {
    locationString = `${geo.city || 'Unknown City'}, ${geo.country || ''}`;
  } else if (isLocal) {
    locationString = "Localhost (Dev)";
  }

  return {
    ip_address: clientIp,
    user_agent: uaRaw,
    browser_name: ua.browser?.name || "Unknown Browser",
    os_name: osName,
    device_type: deviceType,
    device_model: model,
    location: locationString,
    geo_raw: geo, 
    screen: {
      width: req.body?.screenWidth || req.headers["x-screen-width"],
      height: req.body?.screenHeight || req.headers["x-screen-height"],
    }
  };
}