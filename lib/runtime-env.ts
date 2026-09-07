import { AsyncLocalStorage } from "node:async_hooks";
export type ServerKeys = {
  GOOGLE_SOLAR_API_KEY?: string;
  GOOGLE_GEOCODING_API_KEY?: string;
  GOOGLE_MAPS_API_KEY?: string;
};
const requestEnvironment = new AsyncLocalStorage<ServerKeys>();
export function withRuntimeEnvironment<T>(env: ServerKeys, run: () => T): T {
  return requestEnvironment.run(env, run);
}
export function runtimeKeys(): ServerKeys {
  return requestEnvironment.getStore() ?? {};
}
export function roofCapabilities() {
  const e = runtimeKeys();
  return {
    googleSolar: !!(
      e.GOOGLE_SOLAR_API_KEY ||
      e.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_SOLAR_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY
    ),
    googleGeocoding: !!(
      e.GOOGLE_GEOCODING_API_KEY ||
      e.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_GEOCODING_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY
    ),
  };
}
