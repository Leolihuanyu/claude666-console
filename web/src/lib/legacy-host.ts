// 2026-11-23 the console moved to api.leoapi.ai. The old claude666.top:8443
// names are forwarded to the same backend until 2026-11-28, so one build serves
// both and only visitors on an old name are told to switch.
export const NEW_CONSOLE_ORIGIN = "https://api.leoapi.ai";

export function isLegacyHost(hostname: string): boolean {
  return /(^|\.)claude666\.top$/.test(hostname);
}
