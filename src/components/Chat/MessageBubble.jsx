import { useEffect, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { WhatsAppParser } from '../../utils/parser';
import MessageMedia from './MessageMedia';
import MessageText from './MessageText';

export default function MessageBubble({ msg, myName }) {
  const { getMediaUrl, getCachedMediaUrl } = useChat();

  // Initialise from the in-memory URL cache (synchronous, no flash)
  const [mediaUrl, setMediaUrl] = useState(
    () => msg.mediaFilename ? getCachedMediaUrl(msg.mediaFilename) : null
  );

  useEffect(() => {
    // Guard: only fetch when we actually have a filename and don't yet have a URL.
    // Use msg.mediaFilename (stable string) rather than the whole msg object
    // so this effect doesn't re-run every time MessageList rebuilds the array.
    if (!msg.mediaType || !msg.mediaFilename || mediaUrl) return;
    let cancelled = false;
    getMediaUrl(msg.mediaFilename).then(url => {
      if (!cancelled && url) setMediaUrl(url);
    });
    return () => { cancelled = true; };
  }, [msg.mediaFilename, msg.mediaType, getMediaUrl, mediaUrl]);

  const isOut = msg.sender === myName;
  const dir   = isOut ? 'out' : 'in';

  const isEmojiOnly =
    msg.text &&
    /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u.test(msg.text) &&
    msg.text.trim().length <= 12;
  const isSticker = msg.mediaType === 'sticker';

  const timeStr = WhatsAppParser.formatTime(msg.timestamp);

  return (
    <div className={`msg-row msg-row--${dir} ${msg.groupClass || ''} ${(!msg.groupClass || msg.groupClass === 'group-top') ? 'group-start' : ''}`}>
      {!isOut && msg.showSender && msg.sender && (
        <div className="msg-sender">{msg.sender}</div>
      )}

      <div className={`bubble bubble--${dir}${isEmojiOnly ? ' emoji-only' : ''}${isSticker ? ' bubble--sticker' : ''}`}>
        <MessageMedia msg={msg} mediaUrl={mediaUrl} />
        <MessageText text={msg.text} />

        <span className="bubble-meta">
          <span className="bubble-time">{timeStr}</span>
        </span>
      </div>

      <div className="msg-time-out">{timeStr}</div>
    </div>
  );
}
