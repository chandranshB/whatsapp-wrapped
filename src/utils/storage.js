/**
 * storage.js — Storage Manager
 *
 * Chat metadata (name, participants, counts …) → localStorage  (tiny, synchronous, fast)
 * Message arrays                               → IndexedDB     (no ~5 MB quota limit)
 * Scroll positions, theme, mode               → localStorage
 *
 * All message-touching operations are async (Promise-based).
 */

'use strict';

import { MediaStorage } from './mediaStorage';

export const Storage = (() => {

  const KEYS = {
    CHAT_LIST:   'chatview_chats',
    SCROLL:      id => `chatview_scroll_${id}`,
    ACTIVE:      'chatview_active',
    THEME:       'chatview_theme',
    MODE:        'chatview_mode',
    LEGACY_DATA: id => `chatview_data_${id}`, // pre-migration localStorage key
  };

  // ── localStorage helpers ──────────────────────────────────────────────────

  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        return { ok: false, reason: 'quota' };
      }
      return { ok: false, reason: e.message };
    }
  }

  function _remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  // ── Chat list (metadata only — always tiny) ───────────────────────────────

  function listChats() {
    return _get(KEYS.CHAT_LIST) || [];
  }

  function _saveMeta(meta) {
    const list = listChats();
    const idx  = list.findIndex(c => c.id === meta.id);
    if (idx >= 0) list[idx] = meta; else list.unshift(meta);
    _set(KEYS.CHAT_LIST, list);
  }

  // ── Chat data (messages → IndexedDB) ─────────────────────────────────────

  /**
   * Save a full chat. Metadata → localStorage, messages → IndexedDB.
   * @param {object} chat
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  async function saveChat(chat) {
    const { messages, ...meta } = chat;
    _saveMeta({ ...meta, messageCount: messages.length });
    try {
      await MediaStorage.saveMessages(chat.id, messages);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e?.message ?? 'idb error' };
    }
  }

  /**
   * Load messages for a chat from IndexedDB, with automatic one-time migration
   * from the old localStorage key for users upgrading from previous versions.
   * @param {string} id
   * @returns {Promise<any[]>}
   */
  async function loadMessages(id) {
    const msgs = await MediaStorage.loadMessages(id);
    if (msgs.length > 0) return msgs;

    // Legacy: data was stored under chatview_data_<id> in localStorage
    const legacy = _get(KEYS.LEGACY_DATA(id));
    if (Array.isArray(legacy) && legacy.length > 0) {
      // Migrate silently — fire-and-forget; data is already in `legacy`
      MediaStorage.saveMessages(id, legacy)
        .then(() => _remove(KEYS.LEGACY_DATA(id)))
        .catch(() => { /* migration is best-effort */ });
      return legacy;
    }

    return [];
  }

  /**
   * Load full chat (meta + messages).
   * @param {string} id
   * @returns {Promise<{ meta: object, messages: any[] } | null>}
   */
  async function loadChat(id) {
    const metas = listChats();
    const meta  = metas.find(c => c.id === id);
    if (!meta) return null;
    const messages = await loadMessages(id);
    return { meta, messages };
  }

  /**
   * Delete a chat — removes metadata, scroll position, messages (IDB + legacy).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteChat(id) {
    const list = listChats().filter(c => c.id !== id);
    _set(KEYS.CHAT_LIST, list);
    _remove(KEYS.SCROLL(id));
    _remove(KEYS.LEGACY_DATA(id));
    await MediaStorage.deleteMessages(id);
  }

  // ── Scroll position ───────────────────────────────────────────────────────

  function saveScroll(id, state) {
    try { localStorage.setItem(KEYS.SCROLL(id), JSON.stringify(state)); } catch { /* ignore */ }
  }

  function loadScroll(id) {
    try {
      const raw = localStorage.getItem(KEYS.SCROLL(id));
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      // Handle legacy plain-number saves
      return typeof parsed === 'number' ? { fromIndex: null, scrollTop: parsed } : parsed;
    } catch {
      return null;
    }
  }

  // ── Active chat ───────────────────────────────────────────────────────────

  function saveActive(id) { _set(KEYS.ACTIVE, id); }
  function loadActive()   { return _get(KEYS.ACTIVE); }
  function clearActive()  { _remove(KEYS.ACTIVE); }

  // ── Theme / Mode ──────────────────────────────────────────────────────────

  function saveTheme(name) { _set(KEYS.THEME, name); }
  function loadTheme()     { return _get(KEYS.THEME) || 'whatsapp'; }

  function saveMode(mode) { _set(KEYS.MODE, mode); }
  function loadMode()     { return _get(KEYS.MODE) || null; }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function estimateFreeSpace() {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key) || '';
      used += (key.length + val.length) * 2; // UTF-16 → 2 bytes per char
    }
    return Math.max(0, 5 * 1024 * 1024 - used);
  }

  return {
    listChats, saveChat, loadChat, loadMessages, deleteChat,
    saveScroll, loadScroll,
    saveActive, loadActive, clearActive,
    saveTheme, loadTheme,
    saveMode, loadMode,
    generateId, estimateFreeSpace,
  };

})();
