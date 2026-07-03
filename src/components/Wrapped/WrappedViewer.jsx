import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { Storage } from '../../utils/storage';
import { generateWrappedStats } from '../../utils/wrappedAnalytics';
import WrappedSlide from './WrappedSlide';

const SLIDE_DURATION = 8000; // ms per slide
const TOTAL_SLIDES   = 13;

// ── Off-thread analytics ───────────────────────────────────────────────────
// We keep a single worker instance. If it errors we null it out so the next
// call recreates it (prevents permanent hangs on a broken worker).
let _wrappedWorker = null;

function getWrappedWorker() {
  if (_wrappedWorker) return _wrappedWorker;
  if (typeof Worker === 'undefined') return null;
  try {
    const w = new Worker(
      new URL('../../utils/wrappedWorker.js', import.meta.url),
      { type: 'module' }
    );
    w.onerror = (e) => {
      console.error('WrappedWorker error:', e);
      _wrappedWorker = null; // allow recreation on next open
    };
    _wrappedWorker = w;
    return w;
  } catch (e) {
    console.warn('Could not create WrappedWorker, falling back to main thread:', e);
    return null;
  }
}

export default function WrappedViewer({ chatId, myName, customNames, onClose }) {
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused]     = useState(false);
  const progressInterval = useRef(null);
  const progressStartRef = useRef(null); // set when a slide actually starts

  const handleClose = useCallback(() => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)
        ?.call(document)
        .catch(() => { /* ignore */ });
    }
    onClose();
  }, [onClose]);

  // ── Load & analyse ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const chat = await Storage.loadChat(chatId);
        if (cancelled) return;

        if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
          setError('No messages found for this chat.');
          setLoading(false);
          return;
        }

        const worker = getWrappedWorker();
        if (worker) {
          // Each Wrapped open gets a dedicated one-shot listener so concurrent
          // opens can't cross-contaminate each other's results.
          const onMsg = (e) => {
            worker.removeEventListener('message', onMsg);
            if (cancelled) return;
            if (e.data?.ok) {
              setStats(e.data.stats);
            } else {
              setError(e.data?.error ?? 'Analysis failed. Please try again.');
            }
            setLoading(false);
          };
          const onErr = () => {
            worker.removeEventListener('message', onMsg);
            _wrappedWorker = null; // worker is broken — allow recreation
            if (cancelled) return;
            setError('Analysis worker crashed. Please try again.');
            setLoading(false);
          };
          worker.addEventListener('message', onMsg);
          worker.addEventListener('error',   onErr, { once: true });
          worker.postMessage({ messages: chat.messages, myName, customNames });
        } else {
          // Fallback: run synchronously on main thread
          try {
            const generatedStats = generateWrappedStats(chat.messages, myName, customNames);
            if (!cancelled) {
              if (generatedStats) setStats(generatedStats);
              else setError('Not enough data to generate Wrapped.');
            }
          } catch {
            if (!cancelled) setError('Analysis failed. Please try again.');
          }
          if (!cancelled) setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this chat. Please try again.');
          setLoading(false);
        }
      }
    };

    // Short delay so the loading animation renders before heavy work starts
    const timer = setTimeout(run, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chatId, myName, customNames]);

  // ── Slide navigation ───────────────────────────────────────────────────────
  const goToNext = useCallback(() => {
    setCurrentSlide(c => {
      if (c < TOTAL_SLIDES - 1) {
        progressStartRef.current = Date.now();
        return c + 1;
      }
      return c;
    });
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentSlide(c => {
      if (c > 0) {
        progressStartRef.current = Date.now();
        return c - 1;
      }
      return c;
    });
  }, []);

  // Progress timer
  useEffect(() => {
    if (loading || !stats || isPaused) {
      clearInterval(progressInterval.current);
      return;
    }
    progressStartRef.current = Date.now();
    progressInterval.current = setInterval(() => {
      if (Date.now() - progressStartRef.current >= SLIDE_DURATION) {
        goToNext();
      }
    }, 100);
    return () => clearInterval(progressInterval.current);
  }, [currentSlide, isPaused, loading, stats, goToNext]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToNext, goToPrev, handleClose]);

  const handlePointerDown = () => setIsPaused(true);
  const handlePointerUp   = (ev) => {
    setIsPaused(false);
    progressStartRef.current = Date.now(); // reset so full 8s starts fresh
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    if (x < rect.width * 0.3)      goToPrev();
    else if (x > rect.width * 0.7) goToNext();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="wrapped-viewer-container loading">
        <div className="spinner" aria-hidden="true"></div>
        <p>Analyzing your chats…</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="wrapped-viewer-container error">
        <p>{error ?? 'Could not analyze this chat. Not enough data.'}</p>
        <button className="btn btn--ghost mt-4" onClick={handleClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="wrapped-viewer-container">
      <div
        className="wrapped-story-card"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setIsPaused(false)}
      >
        <div className="wrapped-progress-container" aria-hidden="true">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
            <div key={idx} className="wrapped-progress-bar">
              <div
                className="wrapped-progress-fill"
                style={{
                  width:     idx < currentSlide ? '100%' : idx > currentSlide ? '0%' : undefined,
                  animationName:           idx === currentSlide && !isPaused ? 'fill-progress' : 'none',
                  animationDuration:       `${SLIDE_DURATION}ms`,
                  animationTimingFunction: 'linear',
                  animationFillMode:       'forwards',
                  animationPlayState:      isPaused ? 'paused' : 'running',
                }}
              />
            </div>
          ))}
        </div>

        <WrappedSlide slideIndex={currentSlide} stats={stats} />

        <button
          className="wrapped-close-btn"
          aria-label="Close Wrapped"
          onClick={(ev)       => { ev.stopPropagation(); handleClose(); }}
          onPointerDown={(ev) => ev.stopPropagation()}
          onPointerUp={(ev)   => ev.stopPropagation()}
        >
          <X size={32} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
