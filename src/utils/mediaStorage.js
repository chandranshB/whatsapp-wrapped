/**
 * mediaStorage.js — IndexedDB Manager for Media + Messages
 *
 * v1 → mediaStore only
 * v2 → added messagesStore (message arrays, no localStorage quota limit)
 *
 * Reliability fixes:
 *  - _dbPromise is reset on rejection so the next call retries the open.
 *  - All public methods catch and surface errors cleanly without leaking
 *    rejected promises into the global unhandledrejection queue.
 */

'use strict';

export const MediaStorage = (() => {

  const DB_NAME    = 'ChatViewMediaDB';
  const DB_VERSION = 2;
  const MEDIA_STORE = 'mediaStore';
  const MSG_STORE   = 'messagesStore'; // added in v2

  let _dbPromise = null;

  function _getDB() {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE);
        }
        if (!db.objectStoreNames.contains(MSG_STORE)) {
          db.createObjectStore(MSG_STORE);
        }
      };

      request.onsuccess = (e) => resolve(e.target.result);

      request.onerror = (e) => {
        // Reset so the next call retries rather than reusing the rejected promise
        _dbPromise = null;
        reject(e.target.error);
      };

      request.onblocked = () => {
        // Another tab has an older version open — not fatal, just log
        console.warn('ChatViewMediaDB upgrade blocked by another tab.');
      };
    });

    return _dbPromise;
  }

  // ── Generic IDB helpers ────────────────────────────────────────────────────

  function _tx(store, mode, fn) {
    return _getDB().then(db => new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(store, mode);
      } catch (e) {
        // Transaction can fail if the store doesn't exist (e.g. old DB version
        // on a different tab). Reset so the next call re-opens with upgrade.
        _dbPromise = null;
        return reject(e);
      }
      tx.onerror = () => reject(tx.error);
      fn(tx.objectStore(store), resolve, reject);
    }));
  }

  // ── Media (Blobs) ──────────────────────────────────────────────────────────

  /**
   * Save a Blob to IndexedDB under "chatId|filename".
   */
  async function saveMedia(chatId, filename, blob) {
    try {
      await _tx(MEDIA_STORE, 'readwrite', (store, resolve, reject) => {
        const req = store.put(blob, `${chatId}|${filename}`);
        req.onsuccess = resolve;
        req.onerror   = () => reject(req.error);
      });
    } catch (e) {
      console.error('MediaStorage.saveMedia failed:', e);
      // Non-fatal — media just won't be cached
    }
  }

  /**
   * Load a Blob from IndexedDB. Returns null when not found.
   */
  async function loadMedia(chatId, filename) {
    try {
      return await _tx(MEDIA_STORE, 'readonly', (store, resolve, reject) => {
        const req = store.get(`${chatId}|${filename}`);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror   = () => reject(req.error);
      });
    } catch (e) {
      console.error('MediaStorage.loadMedia failed:', e);
      return null;
    }
  }

  /**
   * Delete all media blobs associated with a chatId.
   */
  async function deleteChatMedia(chatId) {
    try {
      await _tx(MEDIA_STORE, 'readwrite', (store, resolve, reject) => {
        const prefix = `${chatId}|`;
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (String(cursor.key).startsWith(prefix)) cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('MediaStorage.deleteChatMedia failed:', e);
    }
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  /**
   * Save a messages array for a chat to IndexedDB (no size limit).
   */
  async function saveMessages(chatId, messages) {
    await _tx(MSG_STORE, 'readwrite', (store, resolve, reject) => {
      const req = store.put(messages, chatId);
      req.onsuccess = resolve;
      req.onerror   = () => reject(req.error);
    });
    // Let errors propagate — storage.js decides how to handle them
  }

  /**
   * Load a messages array from IndexedDB. Returns [] when not found.
   */
  async function loadMessages(chatId) {
    try {
      return await _tx(MSG_STORE, 'readonly', (store, resolve, reject) => {
        const req = store.get(chatId);
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror   = () => reject(req.error);
      });
    } catch (e) {
      console.error('MediaStorage.loadMessages failed:', e);
      return [];
    }
  }

  /**
   * Delete the messages record for a chat.
   */
  async function deleteMessages(chatId) {
    try {
      await _tx(MSG_STORE, 'readwrite', (store, resolve, reject) => {
        const req = store.delete(chatId);
        req.onsuccess = resolve;
        req.onerror   = () => reject(req.error);
      });
    } catch (e) {
      console.error('MediaStorage.deleteMessages failed:', e);
    }
  }

  return {
    saveMedia, loadMedia, deleteChatMedia,
    saveMessages, loadMessages, deleteMessages,
  };

})();
