/**
 * parser.js — WhatsApp Export Parser
 * Handles Android & iOS export formats, 12h/24h, multi-line messages.
 * WhatsApp Export Viewer
 */

'use strict';

export const WhatsAppParser = (() => {

  /**
   * Matches the start of a WhatsApp message line.
   * Handles:
   *   - Android: "1/1/22, 1:00 AM - Sender: Message"
   *   - Android: "01/01/22, 13:00 - Sender: Message"
   *   - iOS:     "[1/1/22, 1:00:00 AM] Sender: Message"
   *   - iOS:     "[01/01/2022, 13:00:00] Sender: Message"
   *   - En-dash (–) and em-dash (—) variants
   *   - LTR mark prefix (\u200e)
   *   - Unicode RTL mark (\u200f)
   */
  const TIMESTAMP_RE = /^[\u200e\u200f\u202a\u202c]*\[?(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?)\]?\s*[\-\u2013\u2014]\s+/;

  /**
   * Sender extraction: "Name: Message"
   * Sender cannot contain a newline.
   * Name can have spaces, emojis, special chars.
   */
  const SENDER_RE = /^([^:\n]{1,60}):\s([\s\S]*)$/;

  /**
   * Media placeholder patterns (localized to English + common variants)
   */
  const MEDIA_PATTERNS = [
    { re: /<Media omitted>/i,        type: 'media',    label: 'Media omitted' },
    { re: /image omitted/i,          type: 'image',    label: 'Image' },
    { re: /video omitted/i,          type: 'video',    label: 'Video' },
    { re: /audio omitted/i,          type: 'audio',    label: 'Audio' },
    { re: /GIF omitted/i,            type: 'gif',      label: 'GIF' },
    { re: /sticker omitted/i,        type: 'sticker',  label: 'Sticker' },
    { re: /document omitted/i,       type: 'document', label: 'Document' },
    { re: /Contact card omitted/i,   type: 'contact',  label: 'Contact card' },
    { re: /\.(jpg|jpeg|png|gif|webp|heic|heif)\s*\(file attached\)/i, type: 'image', label: 'Image' },
    { re: /\.(mp4|mov|avi|mkv)\s*\(file attached\)/i,  type: 'video', label: 'Video' },
    { re: /\.(mp3|ogg|opus|m4a|aac|wav)\s*\(file attached\)/i, type: 'audio', label: 'Audio' },
    { re: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)\s*\(file attached\)/i, type: 'document', label: 'Document' },
    { re: /\(file attached\)/i,      type: 'media',    label: 'File attached' },
  ];

  /**
   * Parse a WhatsApp export text file.
   * @param {string} rawText - Contents of the .txt export file
   * @returns {{ messages: Message[], participants: Participant[] }}
   */
  function parse(rawText) {
    // Strip BOM if present
    const text = rawText.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);

    const messages = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tsMatch = TIMESTAMP_RE.exec(line);

      if (tsMatch) {
        // Commit previous message
        if (current) {
          const finalized = finalize(current);
          if (finalized) messages.push(finalized);
        }

        const dateStr = tsMatch[1];
        const timeStr = tsMatch[2];
        const rest = line.slice(tsMatch[0].length); // Everything after "date, time - "

        const timestamp = parseTimestamp(dateStr, timeStr);
        const senderMatch = SENDER_RE.exec(rest);

        if (senderMatch) {
          current = {
            type: 'message',
            timestamp,
            rawDate: `${dateStr}, ${timeStr}`,
            sender: senderMatch[1].trim(),
            text: senderMatch[2],
          };
        } else {
          // System message (no sender:)
          current = {
            type: 'system',
            timestamp,
            rawDate: `${dateStr}, ${timeStr}`,
            sender: null,
            text: rest.trim(),
          };
        }
      } else if (current) {
        // Continuation line (multi-line message)
        if (line.trim() !== '') {
          current.text += '\n' + line;
        } else {
          current.text += '\n';
        }
      }
      // Lines before any valid message are ignored
    }

    // Commit last message
    if (current) {
      const finalized = finalize(current);
      if (finalized) messages.push(finalized);
    }

    const participants = getParticipants(messages);
    return { messages, participants };
  }

  /**
   * Regex that matches the WhatsApp "file attached" pattern:
   *   "IMG-20260101-WA0001.jpg (file attached)"
   *   "PTT-20260101-WA0001.opus (file attached)"
   * Captures the full filename (group 1) and extension (group 2).
   */
  const ATTACHED_RE = /^(.+?\.(\w{2,5}))\s*\(file attached\)/i;

  /** Map file extension → media type string */
  function _extToType(ext) {
    const e = ext.toLowerCase();
    if (/^(jpg|jpeg|png|gif|webp|heic|heif|bmp|avif)$/.test(e)) return 'image';
    if (/^(mp4|mov|avi|3gp|mkv|webm)$/.test(e))               return 'video';
    if (/^(opus|ogg|mp3|m4a|aac|wav|flac|amr)$/.test(e))      return 'audio';
    if (/^(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/.test(e)) return 'document';
    return null;
  }

  /** Human-readable label for a media type + extension */
  function _mediaLabelFor(type, ext) {
    if (ext === 'opus' || ext === 'ogg' || ext === 'amr') return 'Voice message';
    return { image: 'Image', video: 'Video', audio: 'Audio', document: 'Document' }[type] || 'File';
  }

  /**
   * Finalize a message object — detect media, trim text, etc.
   * Priority:
   *   1. "FILENAME.EXT (file attached)" → extract filename for real media rendering
   *   2. Pattern-based placeholders ("<Media omitted>", "image omitted", etc.)
   *   3. Plain text
   */
  function finalize(msg) {
    if (msg.type === 'message') {
      const text = msg.text.trim();

      // 1. Attached file with known extension?
      const attached = ATTACHED_RE.exec(text);
      if (attached) {
        const filename  = attached[1].trim();
        const ext       = attached[2].toLowerCase();
        let mediaType   = _extToType(ext);
        
        // Detect WhatsApp stickers (usually .webp or prefixed with STK-)
        if (filename.toUpperCase().startsWith('STK') || ext === 'webp') {
          mediaType = 'sticker';
        }

        if (mediaType) {
          msg.mediaType     = mediaType;
          msg.mediaFilename = filename;           // Actual filename inside the ZIP
          msg.mediaLabel    = _mediaLabelFor(mediaType, ext);
          msg.text          = '';
          return msg;
        }
      }

      // 2. Pattern-based placeholder (<Media omitted>, image omitted, etc.)
      const media = detectMedia(text);
      if (media) {
        msg.mediaType  = media.type;
        msg.mediaLabel = media.label;
        msg.text       = '';
      } else {
        // 3. Plain text
        msg.text = text;
      }
      
      // If message is entirely empty (no text, no media), treat it as a View Once message.
      if (!msg.text && !msg.mediaType) {
        msg.mediaType = 'media';
        msg.mediaLabel = 'View once message omitted';
      }
    }
    return msg;
  }

  /**
   * Detect if a message is a media placeholder.
   */
  function detectMedia(text) {
    for (const pattern of MEDIA_PATTERNS) {
      if (pattern.re.test(text)) {
        return { type: pattern.type, label: pattern.label };
      }
    }
    return null;
  }

  /**
   * Parse a date + time string into a JS Date.
   * Handles DD/MM/YY, MM/DD/YY, DD/MM/YYYY etc. heuristically.
   * Returns a Date object (may be Invalid Date if unparseable — caller should handle).
   */
  function parseTimestamp(dateStr, timeStr) {
    // Normalize separators
    const dateParts = dateStr.split(/[\/\.\-]/);
    if (dateParts.length !== 3) return new Date(NaN);

    let [a, b, c] = dateParts.map(Number);

    // Expand 2-digit year
    if (c < 100) c += c < 50 ? 2000 : 1900;

    let day, month, year;

    // Heuristic: if a > 12, it must be the day (DD/MM/YYYY)
    // If b > 12, it must be the day in position b (MM/DD/YYYY)
    // Default assumption: DD/MM/YYYY (WhatsApp's most common format)
    if (a > 12) {
      day = a; month = b; year = c;
    } else if (b > 12) {
      day = b; month = a; year = c;
    } else {
      // Ambiguous — default to DD/MM/YYYY (international)
      day = a; month = b; year = c;
    }

    // Parse time — one-pass AM/PM resolution to avoid double-correction
    const timeParts = timeStr.trim().split(/[:\s]/);
    let hours   = parseInt(timeParts[0], 10) || 0;
    let minutes = parseInt(timeParts[1], 10) || 0; // eslint-disable-line no-unused-vars
    let seconds = 0;
    let ampm    = ''; // 'am' | 'pm' | ''

    if (timeParts.length >= 3) {
      const third = timeParts[2];
      seconds = parseInt(third, 10) || 0;
      if (/pm/i.test(third)) ampm = 'pm';
      else if (/am/i.test(third)) ampm = 'am';
    }

    // Trailing AM/PM token after seconds (e.g. ["1","30","45","PM"])
    if (timeParts.length >= 4) {
      const last = timeParts[timeParts.length - 1];
      if (/^pm$/i.test(last)) ampm = 'pm';
      else if (/^am$/i.test(last)) ampm = 'am';
    }

    // AM/PM embedded in minutes when there are only 2 tokens (e.g. "1:30PM")
    if (timeParts.length === 2) {
      if (/pm/i.test(timeParts[1])) ampm = 'pm';
      else if (/am/i.test(timeParts[1])) ampm = 'am';
    }

    // Apply AM/PM adjustment exactly once
    if (ampm === 'pm' && hours < 12) hours += 12;
    else if (ampm === 'am' && hours === 12) hours = 0;

    // month is 1-indexed in our logic, but Date() uses 0-indexed
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }

  /**
   * Extract unique participants sorted by message count (desc).
   */
  function getParticipants(messages) {
    const counts = new Map();
    for (const msg of messages) {
      if (msg.type === 'message' && msg.sender) {
        counts.set(msg.sender, (counts.get(msg.sender) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }

  /**
   * Format a Date for display.
   */
  function formatTime(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date)) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Format a Date as a chat date divider string.
   */
  function formatDateDivider(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date)) return '';
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * Get the date-only string for grouping (YYYY-MM-DD).
   */
  function dateKey(date) {
    if (!(date instanceof Date) || isNaN(date)) return 'unknown';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  // Public API
  return { parse, formatTime, formatDateDivider, dateKey };

})();
