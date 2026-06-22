import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { Storage } from '../utils/storage';
import { MediaStorage } from '../utils/mediaStorage';
import { WhatsAppParser } from '../utils/parser';

const getMimeType = (ext) => {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', bmp: 'image/bmp',
    heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
    mp4: 'video/mp4',   mov: 'video/quicktime', avi: 'video/x-msvideo',
    '3gp': 'video/3gpp', mkv: 'video/x-matroska', webm: 'video/webm',
    opus: 'audio/ogg',  ogg: 'audio/ogg',  mp3: 'audio/mpeg',
    m4a:  'audio/mp4',  aac: 'audio/aac',  wav: 'audio/wav', amr: 'audio/amr',
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext.toLowerCase()] || null;
};

export function useFileImport(addMediaUrls, saveNewChat) {
  const [pendingParse, setPendingParse] = useState(null);
  const [isNameModalOpen, setNameModalOpen] = useState(false);

  const processText = useCallback((text, filename, chatId = null) => {
    try {
      const result = WhatsAppParser.parse(text);
      if (!result.messages.length) {
        alert('No messages found in this export.');
        return;
      }
      if (!result.participants.length) {
        alert('No participants found in this export.');
        return;
      }
      setPendingParse({ ...result, filename, chatId });
      setNameModalOpen(true);
    } catch (e) {
      console.error('Parse error:', e);
      alert('Failed to parse the chat export. Please check the file format.');
    }
  }, []);

  const handleZipFile = useCallback(async (file) => {
    try {
      const zip = await JSZip.loadAsync(file);

      // Find the chat text file — prefer one with "chat" in the name
      let txtEntry = null;
      let txtName  = '';
      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        const lower = relativePath.toLowerCase();
        if (lower.endsWith('.txt') && (!txtEntry || lower.includes('chat'))) {
          txtEntry = entry;
          txtName  = relativePath;
        }
      });

      if (!txtEntry) {
        alert('No chat .txt found inside this ZIP.');
        return;
      }

      const pendingChatId = Storage.generateId();
      const newUrlsMap    = new Map();

      // Process media files in parallel
      const mediaJobs = [];
      zip.forEach((relativePath, entry) => {
        if (entry.dir || relativePath.toLowerCase().endsWith('.txt')) return;
        const filename = relativePath.split('/').pop();
        const ext      = filename.split('.').pop().toLowerCase();
        const mime     = getMimeType(ext);
        if (!mime) return;

        mediaJobs.push(
          entry.async('arraybuffer').then(async buf => {
            const blob = new Blob([buf], { type: mime });
            const url  = URL.createObjectURL(blob);
            newUrlsMap.set(`${pendingChatId}|${filename}`, url);
            await MediaStorage.saveMedia(pendingChatId, filename, blob);
          })
        );
      });

      // Wait for all media, but don't let a single media failure abort the import
      const results = await Promise.allSettled(mediaJobs);
      results.forEach(r => {
        if (r.status === 'rejected') console.warn('Media import skipped:', r.reason);
      });

      addMediaUrls(newUrlsMap);

      const text     = await txtEntry.async('string');
      const hintName = file.name.replace(/\.zip$/i, '.txt') || txtName;
      processText(text, hintName, pendingChatId);
    } catch (err) {
      console.error('ZIP read error:', err);
      alert('Could not read the ZIP file. It may be corrupted or password-protected.');
    }
  }, [addMediaUrls, processText]);

  const readTxtFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload  = e => processText(e.target.result, file.name);
    reader.onerror = () => alert('Could not read the file. Please try again.');
    reader.readAsText(file, 'utf-8');
  }, [processText]);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if      (name.endsWith('.zip')) await handleZipFile(file);
    else if (name.endsWith('.txt')) readTxtFile(file);
    else alert('Please select a WhatsApp export .txt or .zip file.');
  }, [handleZipFile, readTxtFile]);

  const confirmName = useCallback(async (myName, chatName) => {
    if (!pendingParse) return;
    const { messages, participants, chatId } = pendingParse;
    const id = chatId || Storage.generateId();

    const validDates = messages
      .map(m => m.timestamp)
      .filter(d => d instanceof Date && !isNaN(d));
    const firstDate = validDates[0]?.toISOString() ?? null;
    const lastDate  = validDates[validDates.length - 1]?.toISOString() ?? null;

    const lastMsg = [...messages].reverse().find(m => m.type === 'message' && m.text);
    const preview = lastMsg
      ? `${lastMsg.sender === myName ? 'You' : lastMsg.sender}: ${lastMsg.text.slice(0, 50)}`
      : null;

    const chat = {
      id,
      name: chatName || myName,
      myName,
      participants: participants.map(p => p.name),
      messageCount: messages.length,
      firstDate,
      lastDate,
      preview,
      importedAt: new Date().toISOString(),
      messages,
    };

    // Close the modal immediately — user shouldn't see it stuck
    setNameModalOpen(false);
    setPendingParse(null);

    try {
      await saveNewChat(chat);
    } catch (e) {
      console.error('Failed to save new chat:', e);
      alert('The chat was parsed but could not be saved. Please try again.');
    }
  }, [pendingParse, saveNewChat]);

  return {
    handleFileSelect,
    isNameModalOpen,
    setNameModalOpen,
    pendingParse,
    confirmName,
  };
}
