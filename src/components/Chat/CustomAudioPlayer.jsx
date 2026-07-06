import { useState, useEffect, useRef } from 'react';

export default function CustomAudioPlayer({ src }) {
  const audioRef    = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]   = useState(0);

  // Reset all state whenever the audio source changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onMetadata = () => setDuration(audio.duration);
    const onTime     = () => setCurrentTime(audio.currentTime);
    const onEnded    = () => { setIsPlaying(false); setCurrentTime(0); };
    // Re-read duration after src change if metadata already loaded
    const onCanPlay  = () => { if (audio.duration && !isNaN(audio.duration)) setDuration(audio.duration); };

    audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('canplay',        onCanPlay);

    // Sync immediately if the element already has data (e.g. browser cache)
    if (audio.readyState >= 2) setDuration(audio.duration);

    return () => {
      audio.removeEventListener('loadedmetadata', onMetadata);
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('canplay',        onCanPlay);
    };
  }, [src]); // re-attach when src changes

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // play() returns a Promise on modern browsers; ignore AbortError which
      // fires when pause() is called before playback actually started.
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch(err => {
          if (err.name !== 'AbortError') console.warn('Audio play failed:', err);
        });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    if (!time || isNaN(time) || !isFinite(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="custom-audio">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        className={`custom-audio__play-btn ${isPlaying ? 'playing' : ''}`}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <svg className="icon-play"  viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        <svg className="icon-pause" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
      </button>

      <div className="custom-audio__progress-wrap">
        <input
          type="range"
          className="custom-audio__slider"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek"
        />
        <span className="custom-audio__time">
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
