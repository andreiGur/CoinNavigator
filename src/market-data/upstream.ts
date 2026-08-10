/** Reuse route-validator public HTTP helpers — no secrets, AbortController timeouts. */
export {
  fetchJson,
  fetchJsonWithFallbacks,
  UpstreamError,
} from '../route-validator/adapters/base.js';
