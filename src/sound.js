import { useRef, useState } from "react";
import { tracks } from "./data.js";

export function useBarSound() {
  const player = useRef(null);
  const audio = useRef(null);
  const selected = useRef(0);
  const enabled = useRef(true);
  const playing = useRef(false);
  const requestId = useRef(0);
  const [index, setIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [failed, setFailed] = useState(false);

  function play() {
    playing.current = true;
    if (!enabled.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      try {
        audio.current ||= new AudioContext();
        audio.current.resume().catch(() => {});
      } catch {}
    }
    const id = ++requestId.current;
    player.current.play().then(() => {
      if (id === requestId.current) setFailed(false);
    }).catch(error => {
      if (id !== requestId.current || error.name === "AbortError") return;
      enabled.current = false;
      setSoundOn(false);
      setFailed(true);
    });
  }

  function pause() {
    playing.current = false;
    requestId.current++;
    player.current.pause();
    audio.current?.suspend().catch(() => {});
  }

  function select(index) {
    selected.current = index;
    const source = "audio/" + encodeURIComponent(tracks[index].file);
    if (player.current.getAttribute("src") !== source) player.current.src = source;
    else player.current.currentTime = 0;
    player.current.volume = .48;
    setIndex(index);
    setFailed(false);
  }

  function toggle() {
    enabled.current = !enabled.current;
    setSoundOn(enabled.current);
    if (enabled.current && playing.current) play();
    else {
      requestId.current++;
      player.current.pause();
    }
  }

  function next() {
    if (!playing.current) return;
    select((selected.current + 1) % tracks.length);
    play();
  }

  function tone(from, duration, volume, type, to) {
    const ctx = audio.current;
    if (!enabled.current || !ctx || ctx.state !== "running") return;
    const at = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }

  return { player, track: tracks[index], soundOn, failed, select, play, pause, toggle, next, tone };
}
