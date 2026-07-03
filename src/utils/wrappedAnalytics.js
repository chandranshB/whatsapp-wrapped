export function generateWrappedStats(messages, myName, customNames = {}) {
  if (!messages || messages.length === 0) return null;

  const validMsgs = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.type !== 'message') continue;
    const dt = new Date(m.timestamp);
    if (isNaN(dt)) continue;
    // Keep only the fields we actually read below — avoids a full shallow
    // copy (...m) of every message, which doubles memory on huge chats.
    validMsgs.push({ text: m.text, sender: m.sender, mediaType: m.mediaType, timestamp: dt });
  }

  if (validMsgs.length === 0) return null;

  const participantsArray = Array.from(new Set(validMsgs.map(m => m.sender == null ? '' : m.sender)));
  const participants = new Set(participantsArray);

  let myOrigName = myName;
  if (myOrigName == null || !participants.has(myOrigName)) {
    myOrigName = participantsArray[0];
  }
  
  let theirOrigName = participantsArray.find(p => p !== myOrigName);
  if (theirOrigName == null) theirOrigName = 'Them';

  let me = customNames[myOrigName];
  if (!me || me.trim() === '') me = myOrigName;
  if (!me || me.trim() === '') me = 'You';

  let them = customNames[theirOrigName];
  if (!them || them.trim() === '') them = theirOrigName;
  if (!them || them.trim() === '') them = 'Them';
  
  me = me.trim();
  them = them.trim();

  // Sort messages chronologically just in case.
  // validMsgs is our own freshly-built array, so sort it in place instead of
  // allocating another full copy ([...validMsgs].sort()).
  validMsgs.sort((a, b) => a.timestamp - b.timestamp);
  const sortedMsgs = validMsgs;

  const firstDate = sortedMsgs[0].timestamp;
  const lastDate = sortedMsgs[sortedMsgs.length - 1].timestamp;
  const totalDays = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

  const stats = {
    me,
    them,
    totalMessages: sortedMsgs.length,
    totalDays,
    firstMessageDate: firstDate,
    lastMessageDate: lastDate,
    counts: { [me]: 0, [them]: 0 },
    words: { [me]: {}, [them]: {} },
    emojis: { [me]: {}, [them]: {} },
    hourly: { [me]: new Array(24).fill(0), [them]: new Array(24).fill(0) },
    starters: { [me]: 0, [them]: 0 },
    ghosts: { [me]: 0, [them]: 0 },
    busiestDay: { date: null, count: 0 },
    longestStreak: 0,
    longestGap: { days: 0, start: null, end: null },
    responseTimes: { [me]: [], [them]: [] },
    monthlyTimeline: {}, // { "YYYY-MM": count }
  };

  const STOPWORDS = new Set([
    'a','about','above','after','again','against','all','am','an','and','any','are','as','at','be','because','been','before','being','below','between','both','but','by','cannot','could','did','do','does','doing','down','during','each','few','for','from','further','had','has','have','having','he','her','here','hers','herself','him','himself','his','how','i','if','in','into','is','it','its','itself','me','more','most','my','myself','no','nor','not','of','off','on','once','only','or','other','ought','our','ours','ourselves','out','over','own','same','she','should','so','some','such','than','that','the','their','theirs','them','themselves','then','there','these','they','this','those','through','to','too','under','until','up','very','was','we','were','what','when','where','which','while','who','whom','why','with','would','you','your','yours','yourself','yourselves',
    'ok', 'okay', 'yeah', 'yes', 'no', 'oh', 'like', 'just', 'get', 'got', 'know', 'think', 'will', 'can', 'one', 'now', 'really', 'well', 'see', 'go', 'going', 'time', 'good', 'day', 'make', 'want', 'come', 'way', 'look', 'much', 'need', 'even', 'back', 'take', 'also', 'say', 'us', 'tell', 'still', 'give', 'right', 'something', 'anything', 'nothing', 'someone', 'anyone', 'everyone', 'everything', 'mean',
    // Contractions (without apostrophes)
    'dont', 'cant', 'wont', 'didnt', 'isnt', 'arent', 'wasnt', 'werent', 'hasnt', 'havent', 'hadnt', 'wouldnt', 'couldnt', 'shouldnt', 'doesnt', 'im', 'youre', 'hes', 'shes', 'its', 'were', 'theyre', 'ive', 'youve', 'weve', 'theyve', 'id', 'youd', 'hed', 'shed', 'wed', 'theyd', 'ill', 'youll', 'hell', 'shell', 'theyll', 'lets', 'thats', 'theres', 'heres', 'whats', 'whos', 'hows', 'ur', 're', 'll', 've', 'th', 'st', 'nd', 'rd', 'am', 'pm',
    // Hinglish & extra stopwords
    'hai', 'toh', 'ki', 'se', 'ko', 'hi', 'bhi', 'tha', 'ye', 'woh', 'mein', 'ek', 'nahi', 'na', 'haan', 'ka', 'ke', 'kya', 'aur', 'karna', 'kar', 'hua', 'yeh', 'main', 'jo', 'par', 'thi', 'the', 'karo', 'diya', 'liye', 'mera', 'meri', 'mere', 'k', 'ab', 'bhai', 'yaar', 'acha', 'achha', 'ha', 'hmm', 'hmmm',
    // Common artifacts
    'message', 'waiting', 'omitted', 'deleted', 'this', 'null', 'http', 'https', 'www', 'com'
  ]);

  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

  function normalizeWord(word) {
    let w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (w.length < 2) return null;
    if (STOPWORDS.has(w)) return null;
    
    // Collapse 3+ repeated chars to 2 (e.g. woooow -> woow, awwwweeee -> awwee, hahahaha -> haha)
    w = w.replace(/(.)\1{2,}/g, '$1$1');
    
    // Simple overrides
    if (/^h+a+(h+a+)+h*$/.test(w)) return 'haha';
    if (/^y+e+s+$/.test(w)) return 'yes';
    if (/^n+o+$/.test(w)) return 'no';
    if (/^w+o+w+$/.test(w)) return 'wow';
    if (/^a+w+$/.test(w)) return 'aww';
    if (/^l+m+a+o+$/.test(w)) return 'lmao';
    if (/^l+o+l+$/.test(w)) return 'lol';
    
    if (STOPWORDS.has(w)) return null;
    
    return w;
  }

  let dailyCounts = {};
  let currentStreak = 0;
  let lastDateStr = null;
  let lastMsgTimestamp = null;
  let lastSender = null;

  sortedMsgs.forEach((msg, index) => {
    const originalSender = msg.sender === myOrigName ? myOrigName : (msg.sender || theirOrigName);
    const sender = originalSender === myOrigName ? me : them;
    stats.counts[sender]++;

    const date = msg.timestamp;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const hour = date.getHours();

    // Hourly
    if (stats.hourly[sender]) {
      stats.hourly[sender][hour]++;
    }

    // Monthly
    stats.monthlyTimeline[monthStr] = (stats.monthlyTimeline[monthStr] || 0) + 1;

    // Daily & Streaks
    dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;

    if (dateStr !== lastDateStr) {
      if (lastDateStr) {
        const lastD = new Date(lastDateStr);
        const currD = new Date(dateStr);
        const diffDays = Math.round((currD - lastD) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          currentStreak++;
        } else {
          stats.longestStreak = Math.max(stats.longestStreak, currentStreak);
          currentStreak = 1;
          
          if (diffDays > stats.longestGap.days) {
            stats.longestGap = { days: diffDays, start: lastD, end: currD, ender: sender };
          }
        }
      } else {
        currentStreak = 1;
      }
      lastDateStr = dateStr;
    }

    // Gaps and Starters and Response Time
    if (lastMsgTimestamp) {
      const diffMs = date - lastMsgTimestamp;
      const diffHours = diffMs / (1000 * 60 * 60);

      // Starter
      if (diffHours >= 4) {
        stats.starters[sender]++;
        const ghoster = lastSender === me ? them : me;
        stats.ghosts[ghoster] = (stats.ghosts[ghoster] || 0) + 1;
      }

      // Response Time
      if (sender !== lastSender && diffHours < 24) { // Include all replies within a day for a realistic overall average
        if (stats.responseTimes[sender]) {
          stats.responseTimes[sender].push(diffMs);
        }
      }
    } else {
      stats.starters[sender]++; // First message ever
    }

    lastMsgTimestamp = date;
    lastSender = sender;

    // Text Analysis
    if (msg.text && !msg.mediaType) {
      const lowerText = msg.text.toLowerCase().trim();
      const isSystemLike = lowerText.includes('waiting for this message') || 
                           lowerText.includes('message was deleted') ||
                           lowerText.includes('deleted this message') ||
                           lowerText === 'null';

      if (!isSystemLike) {
        // Emojis
        const emojis = msg.text.match(emojiRegex);
        if (emojis) {
          emojis.forEach(e => {
            stats.emojis[sender][e] = (stats.emojis[sender][e] || 0) + 1;
          });
        }

        // Words
        const cleanText = msg.text.replace(/['`’]/g, '');
        const words = cleanText.split(/[\s,.\-!?"()[\]{}<>:;\/\\+*&^%$#@~=]+/);
        words.forEach(w => {
          const norm = normalizeWord(w);
          if (norm) {
            stats.words[sender][norm] = (stats.words[sender][norm] || 0) + 1;
          }
        });
      }
    }
  });

  stats.longestStreak = Math.max(stats.longestStreak, currentStreak);

  // Busiest Day
  let maxCount = 0;
  for (const [dateStr, count] of Object.entries(dailyCounts)) {
    if (count > maxCount) {
      maxCount = count;
      stats.busiestDay = { date: new Date(dateStr), count };
    }
  }

  // Format final stats
  return {
    me: stats.me,
    them: stats.them,
    totalMessages: stats.totalMessages,
    totalDays: stats.totalDays,
    firstDate: stats.firstMessageDate,
    counts: stats.counts,
    topWords: {
      [stats.me]: Object.entries(stats.words[stats.me] || {}).sort((a, b) => b[1] - a[1]).slice(0, 5),
      [stats.them]: Object.entries(stats.words[stats.them] || {}).sort((a, b) => b[1] - a[1]).slice(0, 5),
    },
    topEmojis: {
      [stats.me]: Object.entries(stats.emojis[stats.me] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3),
      [stats.them]: Object.entries(stats.emojis[stats.them] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3),
    },
    busiestDay: stats.busiestDay,
    starters: stats.starters,
    ghosts: stats.ghosts,
    hourly: stats.hourly,
    longestStreak: stats.longestStreak,
    longestGap: stats.longestGap,
    avgResponseMs: {
      [stats.me]: getAverage(stats.responseTimes[stats.me]),
      [stats.them]: getAverage(stats.responseTimes[stats.them]),
    },
    monthlyTimeline: Object.entries(stats.monthlyTimeline).map(([k, v]) => ({ month: k, count: v })).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

const getAverage = (arr) => {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};
