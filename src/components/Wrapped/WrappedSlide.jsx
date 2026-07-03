import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MessageCircle, Clock, Flame, Ghost, DoorOpen, Sun, Moon, Heart, Sparkles, Zap, ArrowRight, Activity } from 'lucide-react';
import TimelineChart from './TimelineChart';

const formatTimeFromHours = (hourCountArr) => {
  if (!hourCountArr) return "Anytime";
  let maxIdx = 0;
  for (let i = 1; i < 24; i++) {
    if (hourCountArr[i] > hourCountArr[maxIdx]) maxIdx = i;
  }
  const ampm = maxIdx >= 12 ? 'PM' : 'AM';
  const h = maxIdx % 12 || 12;
  return `${h} ${ampm}`;
};

// Animation variants for Framer Motion
const slideVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

const scaleVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }
  }
};

export default function WrappedSlide({ slideIndex, stats }) {
  const { 
    me, them, totalMessages, totalDays, firstDate, counts, 
    topWords, topEmojis, busiestDay, starters, ghosts, hourly, 
    longestStreak, longestGap, avgResponseMs, monthlyTimeline 
  } = stats;

  const bgClasses = [
    'bg-bold-1', 'bg-bold-2', 'bg-bold-3', 'bg-bold-4',
    'bg-bold-5', 'bg-bold-6', 'bg-bold-7', 'bg-bold-8',
    'bg-bold-9', 'bg-bold-10', 'bg-bold-11', 'bg-bold-12'
  ];
  const bgClass = bgClasses[slideIndex % bgClasses.length];

  const renderContent = () => {
    switch (slideIndex) {
      case 0:
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-0">
            <motion.div variants={scaleVariants} className="large-icon-container">
              <Sparkles className="large-icon" />
            </motion.div>
            <motion.h2 className="slide-pretitle" variants={itemVariants}>Your year with</motion.h2>
            <motion.h1 className="slide-title-huge" variants={itemVariants}>{them}</motion.h1>
            <motion.div className="slide-date-range mt-8" variants={itemVariants}>
              {firstDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} — Now
            </motion.div>
          </motion.div>
        );
      
      case 1:
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-1">
            <motion.h2 className="slide-title" variants={itemVariants}>You two couldn't stop talking.</motion.h2>
            <motion.div className="big-number" variants={scaleVariants}>
              {totalMessages.toLocaleString()}
            </motion.div>
            <motion.p className="slide-text" variants={itemVariants}>messages sent over <strong>{totalDays}</strong> days.</motion.p>
          </motion.div>
        );

      case 2:
        const myPercent = Math.round((counts[me] / totalMessages) * 100);
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-2">
            <motion.h2 className="slide-title" variants={itemVariants}>Who carried the conversation?</motion.h2>
            <motion.div className="donut-chart-container" variants={scaleVariants}>
              <div className="donut-chart" style={{ '--percent': `${myPercent}%` }}></div>
              <div className="donut-text">
                <span className="donut-text-val">{myPercent}%</span>
                <span className="donut-text-name">{me}</span>
              </div>
            </motion.div>
            <motion.div className="split-stats" variants={itemVariants}>
              <div className="split-stat">
                <span className="split-name">{me}</span>
                <span className="split-val">{counts[me].toLocaleString()}</span>
              </div>
              <div className="split-stat">
                <span className="split-name">{them}</span>
                <span className="split-val">{counts[them].toLocaleString()}</span>
              </div>
            </motion.div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-3">
            <motion.h2 className="slide-title" variants={itemVariants}>But one day stood out from the rest.</motion.h2>
            <motion.div variants={scaleVariants} className="large-icon-container">
              <Calendar className="large-icon" />
            </motion.div>
            <motion.div className="busiest-date" variants={itemVariants}>
              {busiestDay?.date
                ? busiestDay.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
                : '—'}
            </motion.div>
            <motion.p className="slide-text mt-4" variants={itemVariants}>You exchanged <strong>{(busiestDay?.count ?? 0).toLocaleString()}</strong> messages that day alone.</motion.p>
          </motion.div>
        );

      case 4:
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-4">
            <motion.h2 className="slide-title" variants={itemVariants}>You definitely had your favorite words.</motion.h2>
            <motion.div className="word-clouds" variants={itemVariants}>
              <div className="word-cloud-col">
                <h3 className="word-cloud-header">{me}</h3>
                <ul className="word-list">
                  {topWords[me].map(([w, c], i) => (
                    <motion.li key={w} className={`word-item rank-${i}`} variants={itemVariants}>
                      <span className="word-text" style={{ textTransform: 'capitalize' }}>{w}</span>
                      <span className="word-count">{c}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
              <div className="word-cloud-col">
                <h3 className="word-cloud-header">{them}</h3>
                <ul className="word-list">
                  {topWords[them].map(([w, c], i) => (
                    <motion.li key={w} className={`word-item rank-${i}`} variants={itemVariants}>
                      <span className="word-text" style={{ textTransform: 'capitalize' }}>{w}</span>
                      <span className="word-count">{c}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-5">
            <motion.h2 className="slide-title" variants={itemVariants}>And your go-to reactions...</motion.h2>
            <motion.div className="emoji-display" variants={itemVariants}>
              <motion.div className="emoji-col" whileHover={{ scale: 1.05 }}>
                <div>
                  <div className="emoji-col-name">{me}</div>
                  <div className="small-emojis">
                    <span>{topEmojis[me][1]?.[0] || ''}</span>
                    <span>{topEmojis[me][2]?.[0] || ''}</span>
                  </div>
                </div>
                <div className="big-emoji">{topEmojis[me][0]?.[0] || '💬'}</div>
              </motion.div>
              <motion.div className="emoji-col" whileHover={{ scale: 1.05 }}>
                <div>
                  <div className="emoji-col-name">{them}</div>
                  <div className="small-emojis">
                    <span>{topEmojis[them][1]?.[0] || ''}</span>
                    <span>{topEmojis[them][2]?.[0] || ''}</span>
                  </div>
                </div>
                <div className="big-emoji">{topEmojis[them][0]?.[0] || '💬'}</div>
              </motion.div>
            </motion.div>
          </motion.div>
        );

      case 6:
        const totalStarters = starters[me] + starters[them] || 1; 
        const myStarterPct = Math.round((starters[me] / totalStarters) * 100);
        const theirStarterPct = Math.round((starters[them] / totalStarters) * 100);
        const starterWinner = starters[me] > starters[them] ? me : them;
        
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-6">
            <motion.h2 className="slide-title" variants={itemVariants}>Who's the conversation starter?</motion.h2>
            <motion.div variants={scaleVariants} className="large-icon-container">
              <DoorOpen className="large-icon" />
            </motion.div>
            <motion.p className="slide-text" variants={itemVariants}>After a long break, <strong>{starterWinner}</strong> was usually the one to say hi first.</motion.p>
            <motion.div style={{ width: '100%', marginTop: '40px' }} variants={itemVariants}>
              <div className="starter-stats">
                <span>{me} {myStarterPct}%</span>
                <span>{theirStarterPct}% {them}</span>
              </div>
              <div className="starter-bar-chart">
                <motion.div className="starter-bar my-bar" initial={{ width: 0 }} animate={{ width: `${Math.max(2, myStarterPct)}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                <motion.div className="starter-bar their-bar" initial={{ width: 0 }} animate={{ width: `${Math.max(2, theirStarterPct)}%` }} transition={{ duration: 1, ease: "easeOut" }} />
              </div>
            </motion.div>
          </motion.div>
        );

      case 7:
        const myHour = formatTimeFromHours(hourly[me]);
        const theirHour = formatTimeFromHours(hourly[them]);
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-7">
            <motion.h2 className="slide-title" variants={itemVariants}>Night Owl or Early Bird?</motion.h2>
            <motion.div className="time-cards" variants={itemVariants}>
              <motion.div className="time-card" variants={itemVariants} whileHover={{ scale: 1.02 }}>
                <div className="time-icon">{myHour.includes('AM') && !myHour.startsWith('12 AM') ? <Sun size={48} /> : <Moon size={48} />}</div>
                <div className="time-info">
                  <div className="time-val">{myHour}</div>
                  <div className="time-label">{me}'s peak</div>
                </div>
              </motion.div>
              <motion.div className="time-card" variants={itemVariants} whileHover={{ scale: 1.02 }}>
                <div className="time-icon">{theirHour.includes('AM') && !theirHour.startsWith('12 AM') ? <Sun size={48} /> : <Moon size={48} />}</div>
                <div className="time-info">
                  <div className="time-val">{theirHour}</div>
                  <div className="time-label">{them}'s peak</div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        );

      case 8:
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-8">
            <motion.h2 className="slide-title" variants={itemVariants}>You kept the momentum going.</motion.h2>
            <motion.div variants={scaleVariants} className="large-icon-container">
              <Flame className="large-icon" />
            </motion.div>
            <motion.p className="slide-text" variants={itemVariants}>Your longest texting streak was</motion.p>
            <motion.div className="big-number" variants={scaleVariants}>{longestStreak}</motion.div>
            <motion.p className="slide-text" variants={itemVariants}>days in a row.</motion.p>
          </motion.div>
        );

      case 9:
        if ((longestGap?.days ?? 0) < 3) {
          return (
            <motion.div className="slide-content quiet-slide" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-9a">
              <motion.h2 className="slide-title" variants={itemVariants}>You basically never stopped talking.</motion.h2>
              <motion.div variants={scaleVariants} className="large-icon-container mt-8">
                <Heart className="large-icon" />
              </motion.div>
              <motion.p className="slide-text mt-8" variants={itemVariants}>Your longest break from <strong>{them}</strong> was only {longestGap?.days ?? 0} days.</motion.p>
            </motion.div>
          );
        }
        return (
          <motion.div className="slide-content quiet-slide" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-9b">
            <motion.h2 className="slide-title" variants={itemVariants}>There were quiet moments, too.</motion.h2>
            <motion.p className="slide-text mt-8" variants={itemVariants}>
              {longestGap?.start
                ? `In ${longestGap.start.toLocaleDateString(undefined, { month: 'long' })}, you and `
                : 'You and '}
              <strong>{them}</strong> went
            </motion.p>
            <motion.div className="big-number quiet-number" variants={scaleVariants}>{longestGap?.days ?? 0}</motion.div>
            <motion.p className="slide-text" variants={itemVariants}>days without a single message.</motion.p>
            <motion.div className="slide-text mt-8" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }} variants={itemVariants}>
              <span>But <strong>{longestGap?.ender || 'you'}</strong> always came back.</span>
              <Heart size={28} style={{ flexShrink: 0 }} />
            </motion.div>
          </motion.div>
        );

      case 10:
        const formatMs = (ms) => {
          const mins = Math.round(ms / 60000);
          if (mins < 1) return "< 1m";
          if (mins < 60) return `${mins}m`;
          const hrs = (mins / 60).toFixed(1);
          return `${hrs}h`;
        };
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-10">
            <motion.h2 className="slide-title" variants={itemVariants}>Fastest Fingers First.</motion.h2>
            <motion.div variants={scaleVariants} className="large-icon-container">
              <Zap className="large-icon" />
            </motion.div>
            <motion.div className="reply-times mt-6" variants={itemVariants}>
              <div className="reply-time-item">
                <div className="reply-name">{me}</div>
                <div className="reply-val">{formatMs(avgResponseMs[me])}</div>
              </div>
              <div className="reply-time-item">
                <div className="reply-name">{them}</div>
                <div className="reply-val">{formatMs(avgResponseMs[them])}</div>
              </div>
            </motion.div>
          </motion.div>
        );

      case 11:
        const totalGhosts = ghosts[me] + ghosts[them] || 1;
        const myGhostPct = Math.round((ghosts[me] / totalGhosts) * 100);
        const theirGhostPct = Math.round((ghosts[them] / totalGhosts) * 100);
        const ghostWinner = ghosts[me] > ghosts[them] ? me : them;
        
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-11">
            <motion.h2 className="slide-title" variants={itemVariants}>Who left who on read?</motion.h2>
            <motion.div variants={scaleVariants} className="large-icon-container">
              <Ghost className="large-icon" />
            </motion.div>
            <motion.p className="slide-text" variants={itemVariants}><strong>{ghostWinner}</strong> was the biggest ghoster, disappearing mid-conversation the most.</motion.p>
            
            <motion.div style={{ width: '100%', marginTop: '40px' }} variants={itemVariants}>
              <div className="starter-stats">
                <span>{me} {myGhostPct}%</span>
                <span>{theirGhostPct}% {them}</span>
              </div>
              <div className="starter-bar-chart">
                <motion.div className="starter-bar my-bar" initial={{ width: 0 }} animate={{ width: `${Math.max(2, myGhostPct)}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                <motion.div className="starter-bar their-bar" initial={{ width: 0 }} animate={{ width: `${Math.max(2, theirGhostPct)}%` }} transition={{ duration: 1, ease: "easeOut" }} />
              </div>
            </motion.div>
          </motion.div>
        );

      case 12:
        return (
          <motion.div className="slide-content" variants={slideVariants} initial="hidden" animate="visible" exit="exit" key="slide-12">
            <motion.h2 className="slide-title" variants={itemVariants}>Your year in a glance.</motion.h2>
            <motion.div className="timeline-chart-wrapper" variants={scaleVariants}>
              <TimelineChart data={monthlyTimeline} />
            </motion.div>
            <motion.p className="slide-text mt-8" variants={itemVariants}>Thanks for reliving these memories.</motion.p>
            <motion.p className="slide-subtext mt-8" variants={itemVariants}>Press ESC to exit</motion.p>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`wrapped-slide-container ${bgClass}`}>
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </div>
  );
}
