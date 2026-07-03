/**
 * wrappedWorker.js — Web Worker for Wrapped analytics
 *
 * Runs the heavy chat analysis (and, when possible, the JSON.parse of the
 * stored messages) OFF the main thread so the UI — and the loading spinner —
 * stay responsive even for very large chat exports.
 *
 * Vite bundles this via `new Worker(new URL('./wrappedWorker.js', import.meta.url), { type: 'module' })`.
 */

import { generateWrappedStats } from './wrappedAnalytics';

self.onmessage = (e) => {
  const { rawMessages, messages, myName, customNames } = e.data || {};

  try {
    // Prefer the raw JSON string so the expensive JSON.parse happens here,
    // off the main thread. Fall back to a pre-parsed array if that's all we got.
    let msgs = messages;
    if (rawMessages != null) {
      msgs = JSON.parse(rawMessages);
    }

    const stats = generateWrappedStats(msgs, myName, customNames);
    self.postMessage({ ok: true, stats });
  } catch (err) {
    self.postMessage({ ok: false, error: err && err.message ? err.message : 'Worker error' });
  }
};
