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

/* eslint-disable @typescript-eslint/no-var-requires */

// Configure DNS to use Google DNS - MUST happen before any network requests
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
console.log('[DNS] Configured to use Google DNS:', dns.getServers());

// Polyfill fetch with node-fetch for better compatibility
const nodeFetch = require('node-fetch');

if (typeof global !== 'undefined') {
  (global as any).fetch = nodeFetch;
  (global as any).Headers = nodeFetch.Headers;
  (global as any).Request = nodeFetch.Request;
  (global as any).Response = nodeFetch.Response;
  console.log('[Fetch] Polyfilled with node-fetch');
}

/* eslint-enable @typescript-eslint/no-var-requires */

export {};
