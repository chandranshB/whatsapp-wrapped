import { useState, useEffect, useCallback, useRef } from 'react';
import { Storage } from '../utils/storage';
import { MediaStorage } from '../utils/mediaStorage';

export function useChatStorage() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [storageWarning, setStorageWarning] = useState(false);

  // Track the in-flight open so stale responses from a previous openChat call
  // are discarded if the user clicks a different chat before the first resolves.
  const openSeqRef = useRef(0);

  const openChat = useCallback(async (id) => {
    const seq = ++openSeqRef.current;
    try {
      const loaded = await Storage.loadChat(id);
      // Discard if another openChat was called while this was in-flight
      if (seq !== openSeqRef.current) return;
      if (!loaded) return;
      setActiveId(id);
      Storage.saveActive(id);
      setActiveChat({ meta: loaded.meta, messages: loaded.messages });
    } catch (e) {
      if (seq !== openSeqRef.current) return;
      console.error('Failed to open chat:', e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChats(Storage.listChats());
    const savedActive = Storage.loadActive();
    if (savedActive) openChat(savedActive);
  }, [openChat]);

  const closeChat = useCallback(() => {
    openSeqRef.current++; // Cancel any in-flight open
    setActiveId(null);
    setActiveChat(null);
    Storage.clearActive();
  }, []);

  const deleteChat = useCallback(async (id) => {
    try {
      await Storage.deleteChat(id);
      await MediaStorage.deleteChatMedia(id);
    } catch (e) {
      console.error('Failed to delete chat:', e);
    }
    setChats(Storage.listChats());
    setActiveId(currentId => {
      if (currentId === id) {
        setActiveChat(null);
        Storage.clearActive();
        return null;
      }
      return currentId;
    });
  }, []);

  const saveNewChat = useCallback(async (chat) => {
    try {
      const result = await Storage.saveChat(chat);
      if (!result.ok) setStorageWarning(true);
    } catch (e) {
      console.error('Failed to save chat:', e);
      setStorageWarning(true);
    }
    setChats(Storage.listChats());
    await openChat(chat.id);
  }, [openChat]);

  return {
    chats, activeId, activeChat,
    storageWarning, setStorageWarning,
    openChat, closeChat, deleteChat, saveNewChat,
  };
}
