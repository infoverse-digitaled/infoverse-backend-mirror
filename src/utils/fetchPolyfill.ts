/**
 * Network configuration for Node.js
 *
 * 1. Configure DNS to use Google DNS (8.8.8.8) to fix DNS resolution issues
 *    on networks with broken DNS (e.g., mobile hotspots)
 * 2. Polyfill fetch with node-fetch for compatibility
 *
 * IMPORTANT: This module uses require() to avoid import hoisting issues.
 * All configurations must run synchronously before other modules load.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// Configure DNS to use Google DNS - MUST happen before any network requests
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
console.log('[DNS] Configured to use Google DNS:', dns.getServers());

// Polyfill fetch with node-fetch for better compatibility
const nodeFetch = require('node-fetch');

/* eslint-enable @typescript-eslint/no-require-imports */

// node-fetch's exports are structurally compatible with the ambient
// fetch/Headers/Request/Response globals Node's own lib types declare, but
// aren't typed as such - a single scoped cast here is clearer than `any` at
// every assignment or re-declaring globals that already exist in lib.dom.
type FetchGlobals = {
  fetch: typeof fetch;
  Headers: typeof Headers;
  Request: typeof Request;
  Response: typeof Response;
};

if (typeof global !== 'undefined') {
  const target = global as unknown as FetchGlobals;
  target.fetch = nodeFetch;
  target.Headers = nodeFetch.Headers;
  target.Request = nodeFetch.Request;
  target.Response = nodeFetch.Response;
  console.log('[Fetch] Polyfilled with node-fetch');
}

export {};
