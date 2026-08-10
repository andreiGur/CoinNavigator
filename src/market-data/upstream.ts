/** Reuse route-validator public HTTP helper — no secrets, AbortController timeouts. */
export { fetchJson, UpstreamError } from '../route-validator/adapters/base.js';
