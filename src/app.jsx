import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { barAssets } from "./assets.js";
import { formatShiftTime, ingredients, menuStages, tracks } from "./data.js";
import { CenterUnderline, NumberTicker } from "./fancy.jsx";
import { Leaderboard, readStorage, useRanking, writeStorage } from "./leaderboard.jsx";
import { createShift, walkoutLimit } from "./shift.js";
import { useBarSound } from "./sound.js";

const bestKey = "le-martini-longest-shift";
const allRecipes = menuStages.flatMap(stage => stage.recipes);
const unlocks = menuStages.map((_, index) =>
  new Set(menuStages.slice(0, index + 1).flatMap(stage => stage.recipes.flatMap(recipe => recipe.mix))));
const ingredientText = keys => keys.map(key => ingredients[key][0]);
const recipeText = recipe => ingredientText(recipe.mix).join(" · ");
const appear = { initial: { opacity: 0, y: 9 }, animate: { opacity: 1, y: 0 }, transition: { duration: .24 } };

function Artwork({ src, className }) {
  return <img src={src} className={className} alt="" draggable={false} />;
}

function Guest({ guest, elapsed, onServe }) {
  if (!guest) return <button type="button" className="guest empty" disabled>Open seat</button>;
  const patience = Math.max(0, (guest.expires - elapsed) / guest.patience);
  return <motion.button type="button" className="guest" onClick={onServe} {...appear}>
    <span className="guest-art">
      <Artwork className="guest-portrait" src={barAssets.guests[guest.person]} />
      <Artwork className="order-image" src={barAssets.cocktails[guest.recipe.name]} />
    </span>
    <span className="guest-name">{guest.person}</span>
    <strong>{guest.recipe.name}</strong><small>{recipeText(guest.recipe)}</small>
    <span className="patience" aria-hidden="true"><span className={patience < .28 ? "low" : ""}
      style={{ transform: "scaleX(" + patience + ")" }} /></span>
  </motion.button>;
}

function Bar({ data, recipeCard, onPause, onAdd, onClear, onServe }) {
  const reduced = useReducedMotion();
  return <section id="game" aria-label="Bartending game">
    <div className="stats">
      <div><span className="eyebrow">TIME OPEN</span><strong id="clock">{formatShiftTime(Math.floor(data.elapsed / 1000))}</strong></div>
      <div><span className="eyebrow">TIPS</span><NumberTicker value={data.tips} /></div>
      <div><span className="eyebrow">STREAK</span><strong id="streak">{data.streak}</strong></div>
      <button className="quiet" id="pause" onClick={onPause}>Pause</button>
      <details id="menu" ref={recipeCard}><summary className="quiet">Recipe card</summary>
        <div id="recipes">{allRecipes.map(recipe => <p key={recipe.name}>
          <Artwork className="recipe-image" src={barAssets.cocktails[recipe.name]} />
          <span><strong>{recipe.name}</strong><br /><span>{recipeText(recipe)}</span></span>
        </p>)}</div>
      </details>
    </div>
    <section className="counter" aria-labelledby="guests-label">
      <div className="section-label"><h2 className="eyebrow" id="guests-label">AT THE BAR</h2><span>Tap a guest to serve</span></div>
      <div id="guests" className="guests">{data.slots.map((guest, index) =>
        <Guest key={guest ? "guest-" + guest.id : "seat-" + index}
          guest={guest} elapsed={data.elapsed} onServe={() => onServe(index)} />)}</div>
    </section>
    <section className="station" aria-labelledby="station-label">
      <div className="section-label">
        <h2 className="eyebrow" id="station-label"><Artwork className="shaker" src={barAssets.glassware.shaker} />MIXING STATION</h2>
        <button className="text-button" id="clear" disabled={!data.glass.length} onClick={onClear}>Empty glass</button>
      </div>
      <div className="mix">
        <img id="glass" className="glass" alt="" src={barAssets.glassware[data.glass.length ? "filled-glass" : "empty-glass"]} />
        <span id="mix">{data.glass.length ? ingredientText(data.glass).join(" + ") : "Glass is empty"}</span>
      </div>
      <div className="ingredients" id="ingredients">{Object.entries(ingredients).map(([key, [name, color]]) =>
        <motion.button key={key} className="ingredient" data-ingredient={key} hidden={!unlocks[data.stage].has(key)}
          whileTap={reduced ? undefined : { scale: .96 }} transition={{ duration: .12 }}
          aria-pressed={data.glass.includes(key)} style={{ "--liquid": color }} onClick={() => onAdd(key)}>
          <Artwork src={barAssets.ingredients[key]} className="ingredient-image" /><span>{name}</span>
        </motion.button>)}</div>
      <p className={"feedback " + (data.feedback.kind || "")} id="feedback" role="status">
        <motion.span key={data.feedback.text} initial={{ opacity: .45 }} animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : .2 }}>{data.feedback.text}</motion.span>
      </p>
    </section>
  </section>;
}

function PauseDialog({ open, elapsed, onResume, onFinish }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={ref} id="pause-dialog" aria-labelledby="pause-title"
    onCancel={event => { event.preventDefault(); onResume(); }}>
    {open && <motion.div {...appear}>
      <div className="pause-content">
        <div><h2 id="pause-title" tabIndex={-1} autoFocus>Shift paused</h2>
          <p className="pause-time"><strong>{formatShiftTime(Math.floor(elapsed / 1000))}</strong> open</p></div>
        <img className="pause-drink" src={barAssets.cocktails["Le Martini"]} alt="" width="256" height="256" />
      </div>
      <button className="primary" id="resume" onClick={onResume}><span className="play-mark" aria-hidden="true" />Resume shift</button>
      <button className="quiet" id="close-bar" onClick={onFinish}>Close the bar</button>
    </motion.div>}
  </dialog>;
}

function App() {
  const sound = useBarSound();
  const ranking = useRanking();
  const shift = useRef(null);
  const clock = useRef({ started: 0, paused: null, excluded: 0 });
  const recipeCard = useRef(null);
  const shiftCount = useRef(0);
  const [phase, setPhase] = useState("intro");
  const [paused, setPaused] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [data, setData] = useState(null);
  const [best, setBest] = useState(() => Number(readStorage(bestKey)) || 0);
  const [newBest, setNewBest] = useState(false);
  const started = useRef(false);

  function elapsed() {
    const time = clock.current;
    return (time.paused ?? performance.now()) - time.started - time.excluded;
  }

  function start() {
    sound.select(shiftCount.current++ % tracks.length);
    sound.play();
    shift.current = createShift();
    clock.current = { started: performance.now(), paused: null, excluded: 0 };
    started.current = true;
    ranking.begin();
    setData(shift.current.read());
    setPaused(false);
    setPhase("game");
  }

  function finish(snapshot, duration) {
    if (!shift.current) return;
    shift.current = null;
    sound.pause();
    const seconds = Math.floor(duration / 1000);
    ranking.finish(snapshot.served ? seconds : 0);
    const record = snapshot.served > 0 && seconds > best;
    if (record) {
      writeStorage(bestKey, String(seconds));
      setBest(seconds);
    }
    setNewBest(record);
    setData({ ...snapshot, elapsed: duration });
    setPaused(false);
    setPhase("results");
  }

  function pause() {
    if (!shift.current || clock.current.paused !== null) return;
    clock.current.paused = performance.now();
    if (recipeCard.current) recipeCard.current.open = false;
    sound.pause();
    setPaused(true);
  }

  function resume() {
    if (!shift.current || clock.current.paused === null) return;
    clock.current.excluded += performance.now() - clock.current.paused;
    clock.current.paused = null;
    sound.play();
    setPaused(false);
  }

  function update(action) {
    if (!shift.current || clock.current.paused !== null) return;
    action(shift.current);
    const snapshot = shift.current.read();
    if (snapshot.closed) finish(snapshot, elapsed());
    else setData(snapshot);
  }

  useEffect(() => {
    if (phase !== "game" || paused) return;
    const timer = setInterval(() => update(current => current.advance(elapsed())), 100);
    function pauseInBackground() { if (document.hidden) pause(); }
    document.addEventListener("visibilitychange", pauseInBackground);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseInBackground);
    };
  }, [phase, paused, best]);

  useEffect(() => {
    if (!started.current) return;
    const selector = { intro: "#start", game: '[data-ingredient="gin"]', results: "#retry" }[phase];
    document.querySelector(selector)?.focus({ preventScroll: true });
  }, [phase]);

  const showRanking = () => setLeaderboardOpen(true);
  return <main>
    <header className="masthead">
      <span className="wordmark">LM<span>.</span></span>
      <div className="mast-track" aria-live="polite">
        <strong id="now-playing">{sound.track.title}</strong>
        <span className="track-label">Rozzo · {sound.track.label}</span>
        {sound.failed && <span className="track-label" id="music-status">Tap Sound to start music</span>}
      </div>
      <div className="mast-actions">
        <CenterUnderline className="stream-link" href="https://album.link/lemartini" target="_blank" rel="noopener"
          aria-label="Listen on streaming">Listen<span className="stream-detail"> on streaming</span> <span aria-hidden="true">↗</span></CenterUnderline>
        <button id="sound" className="quiet" aria-pressed={sound.soundOn} onClick={sound.toggle}>Sound {sound.soundOn ? "on" : "off"}</button>
      </div>
    </header>
    {phase === "intro" && <motion.section id="intro" className="intro" {...appear}>
      <div className="intro-copy">
        <p className="eyebrow"><span className="dot" /> THE 124 BPM BARTENDING GAME</p>
        <h1>Le <em>Martini</em></h1>
        <p className="pitch">Keep the bar open as long as you can. Five guests walking out in a row will end your shift.</p>
        <div className="mode-actions">
          <button className="primary" id="start" onClick={start}>Open the bar <span aria-hidden="true">↗</span></button>
          <button className="quiet" data-leaderboard onClick={showRanking}>Leaderboard</button>
        </div>
        {best > 0 && <p className="best">Longest shift · {formatShiftTime(best)}</p>}
      </div>
      <figure className="poster"><img src={barAssets.cover} alt="Rozzo · Le Martini single cover"
        width="447" height="447" fetchPriority="high" /></figure>
    </motion.section>}
    {phase === "game" && <Bar data={data} recipeCard={recipeCard} onPause={pause}
      onAdd={key => update(shift => { shift.add(key); sound.tone(510, .055, .022, "sine", 660); })}
      onClear={() => update(shift => shift.clear())}
      onServe={index => update(shift => {
        const grade = shift.serve(index, elapsed());
        if (grade === "good") sound.tone(680, .12, .04, "sine", 1020);
        if (grade === "bad") sound.tone(150, .15, .032, "triangle", 94);
      })} />}
    {phase === "results" && <motion.section id="results" className="results" {...appear}>
      <p className="eyebrow" id="record">{newBest ? "NEW " : ""}LONGEST SHIFT · {formatShiftTime(best)}</p>
      <h2>Last call.</h2>
      <p id="summary">{formatShiftTime(Math.floor(data.elapsed / 1000))} open · ${data.tips} in tips · {data.served} served · {data.walked} walked out</p>
      {data.closed && <p>Five guests walked out in a row.</p>}
      <button className="primary" id="retry" onClick={start}>Play again <span aria-hidden="true">↗</span></button>
      <button className="quiet" id="main-menu" onClick={() => setPhase("intro")}>Main menu</button>
      <button className="quiet" data-leaderboard onClick={showRanking}>Leaderboard</button>
    </motion.section>}
    <footer><span>LE MARTINI</span><span>DEEP HOUSE <span className="dot" /> 124 BPM</span></footer>
    <PauseDialog open={paused} elapsed={paused ? elapsed() : 0} onResume={resume}
      onFinish={() => { if (shift.current) finish(shift.current.read(), elapsed()); }} />
    <Leaderboard open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} run={ranking.run} submit={ranking.submit} />
    <audio id="music" ref={sound.player} preload="none" onEnded={sound.next} />
  </main>;
}

createRoot(document.getElementById("root")).render(<MotionConfig reducedMotion="user"><App /></MotionConfig>);
