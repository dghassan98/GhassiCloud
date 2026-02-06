/**
 * Lightweight bridge to share SSO session readiness state
 * between SSOSessionManager (provider) and ServiceCard (consumer).
 * 
 * This avoids adding a full React context just for one function.
 */

let _ensureSessionReady = async () => true
let _sessionWarmedUp = false

export function setEnsureSessionReady(fn) {
  _ensureSessionReady = fn
}

export function setSessionWarmedUp(value) {
  _sessionWarmedUp = value
}

export function getSessionWarmedUp() {
  return _sessionWarmedUp
}

export async function ensureSessionReady() {
  return _ensureSessionReady()
}
