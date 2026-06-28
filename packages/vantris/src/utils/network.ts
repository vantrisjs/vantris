import { networkInterfaces } from "node:os";

/**
 * Returns the first non-internal IPv4 address of this machine (the LAN IP),
 * or `null` when only loopback interfaces are available.
 *
 * Used to print a "Network" URL so the preview can be opened from other
 * devices on the same network.
 */
export function getNetworkHost(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}
