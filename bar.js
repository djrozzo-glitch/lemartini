"use strict";

const ingredients = {
  gin: ["Gin", "#b8cddb"], vermouth: ["Vermouth", "#e7cf8b"],
  olive: ["Olive", "#bfc969"], campari: ["Campari", "#f38488"],
  vodka: ["Vodka", "#b5a8e0"], grenadine: ["Grenadine", "#ee5373"],
  tabasco: ["Tabasco", "#ff8d60"], whiskey: ["Whiskey", "#d6a163"],
  tequila: ["Tequila", "#eac582"], rum: ["Rum", "#d59c7b"],
};
const menuStages = [
  { start: 0, recipes: [
    { name: "Le Martini", mix: ["gin", "vermouth", "olive"] },
    { name: "Negroni", mix: ["gin", "vermouth", "campari"] },
    { name: "Milano–Torino", mix: ["vermouth", "campari"] },
  ] },
  { start: 20_000, recipes: [
    { name: "Bloody Boyarsky", mix: ["vodka", "grenadine", "tabasco"] },
    { name: "Vodka Martini", mix: ["vodka", "vermouth", "olive"] },
  ] },
  { start: 42_000, recipes: [
    { name: "Fall of Christianity", mix: ["vodka", "whiskey", "tequila", "rum"] },
    { name: "Boulevardier", mix: ["whiskey", "vermouth", "campari"] },
    { name: "Rosita", mix: ["tequila", "vermouth", "campari"] },
  ] },
];
const regulars = Object.keys(barAssets.guests);
const get = (id) => document.getElementById(id);
const walkoutLimit = 5;
const bestTimeKey = "le-martini-longest-shift";
const slots = Array(3).fill(null);
const guestButtons = [];
const ingredientButtons = new Map();
const glass = new Set();
const orderedRecipes = new Set();
let phase = "intro";
let tips = 0, streak = 0, served = 0, walked = 0, walkoutStreak = 0;
let shiftStart = 0, nextGuest = 0, frame = 0;
let lastClock = -1;
let menuStage = 0;
let availableRecipes = [];
let pausedAt = null;
let pausedDuration = 0;
const gameTime = () => (pausedAt ?? performance.now()) - pausedDuration;
const tracks = [
  { title: "Le Martini", label: "See the Sea Records", file: "rozzo – le martini [See the Sea Records].mp3" },
  { title: "No But No", label: "See the Sea Records", file: "rozzo – no but no [See the Sea Records].mp3" },
];
const music = get("music");
const nowPlaying = get("now-playing");
const trackLabel = get("track-label");
const musicStatus = get("music-status");
const soundButton = get("sound");
let soundOn = true;
let audio;
let trackIndex = 0;
let shiftCount = 0;
music.volume = .48;
function formatShiftTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const tail = String(seconds % 60).padStart(2, "0");
  if (minutes < 60) return minutes + ":" + tail;
  return Math.floor(minutes / 60) + ":" + String(minutes % 60).padStart(2, "0") + ":" + tail;
}

function readBestTime() {
  try { return Number(localStorage.getItem(bestTimeKey)) || 0; } catch { return 0; }
}

function showEndlessBest() {
  const best = readBestTime();
  get("intro-best").textContent = "Longest shift · " + formatShiftTime(best);
  get("intro-best").hidden = !best;
}

showEndlessBest();

function sprite(source, className) {
  const image = document.createElement("img");
  image.alt = "";
  image.className = className;
  image.src = source;
  image.draggable = false;
  return image;
}

menuStages.flatMap((stage) => stage.recipes).forEach((recipe) => {
  const row = document.createElement("p");
  const title = document.createElement("strong");
  const description = document.createElement("span");
  title.textContent = recipe.name;
  description.textContent = recipe.mix.map((key) => ingredients[key][0]).join(" · ");
  const copy = document.createElement("span");
  copy.append(title, document.createElement("br"), description);
  row.append(sprite(barAssets.cocktails[recipe.name], "recipe-image"), copy);
  get("recipes").append(row);
});
for (const [key, [name, color]] of Object.entries(ingredients)) {
  const button = document.createElement("button");
  button.className = "ingredient";
  const label = document.createElement("span");
  label.textContent = name;
  button.append(sprite(barAssets.ingredients[key], "ingredient-image"), label);
  button.style.setProperty("--liquid", color);
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    if (!shiftOpen()) return;
    if (glass.has(key)) glass.delete(key);
    else glass.add(key);
    updateGlass();
    tone(510, .055, .022, "sine", 660);
  });
  ingredientButtons.set(key, button);
  get("ingredients").append(button);
}
for (let index = 0; index < slots.length; index++) {
  const button = document.createElement("button");
  button.addEventListener("click", () => serve(index));
  guestButtons.push(button);
  get("guests").append(button);
  renderSlot(index);
}

function feedback(text, kind = "") {
  const status = get("feedback");
  status.textContent = text;
  status.className = "feedback " + kind;
}

function updateGlass() {
  const glassImage = get("glass");
  const nextImage = barAssets.glassware[glass.size ? "filled-glass" : "empty-glass"];
  if (glassImage.getAttribute("src") !== nextImage) glassImage.src = nextImage;
  get("mix").textContent = glass.size ? [...glass].map((key) => ingredients[key][0]).join(" + ") : "Glass is empty";
  get("clear").disabled = glass.size === 0;
  for (const [key, button] of ingredientButtons) button.setAttribute("aria-pressed", glass.has(key));
}

function emptyGlass() {
  glass.clear();
  updateGlass();
}

function renderSlot(index) {
  const guest = slots[index];
  const button = guestButtons[index];
  button.disabled = !guest;
  if (!guest) {
    button.className = "guest empty";
    button.textContent = "Open seat";
    return;
  }
  button.className = "guest";
  button.innerHTML = '<span class="guest-art"></span><span class="guest-name"></span><strong></strong><small></small><span class="patience" aria-hidden="true"><span></span></span>';
  button.querySelector(".guest-art").append(
    sprite(barAssets.guests[guest.person], "guest-portrait"),
    sprite(barAssets.cocktails[guest.recipe.name], "order-image"),
  );
  button.querySelector(".guest-name").textContent = guest.person;
  button.querySelector("strong").textContent = guest.recipe.name;
  button.querySelector("small").textContent = guest.recipe.mix.map((key) => ingredients[key][0]).join(" · ");
  guest.bar = button.querySelector(".patience span");
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function setMenuStage(index) {
  menuStage = index;
  availableRecipes = menuStages.slice(0, index + 1).flatMap((stage) => stage.recipes);
  const availableIngredients = new Set(availableRecipes.flatMap((recipe) => recipe.mix));
  for (const [key, button] of ingredientButtons) button.hidden = !availableIngredients.has(key);
}

function seatGuest(now) {
  const openSeat = slots.indexOf(null);
  if (openSeat === -1) return;
  const elapsed = now - shiftStart;
  const activeNames = new Set(slots.filter(Boolean).map((guest) => guest.person));
  const activeOrders = new Set(slots.filter(Boolean).map((guest) => guest.recipe));
  const options = availableRecipes.filter((recipe) => !activeOrders.has(recipe));
  const newOrders = options.filter((recipe) => !orderedRecipes.has(recipe));
  const featured = menuStages.slice(0, menuStage + 1)
    .map((stage) => stage.recipes[0])
    .find((recipe) => !orderedRecipes.has(recipe));
  const recipe = featured ?? randomChoice(newOrders.length ? newOrders : options);
  const patience = Math.max(22_000, 29_000 - elapsed * .09) + 3000 * Math.max(0, recipe.mix.length - 3);
  orderedRecipes.add(recipe);
  slots[openSeat] = {
    person: randomChoice(regulars.filter((person) => !activeNames.has(person))),
    recipe,
    expires: now + patience,
    patience,
  };
  renderSlot(openSeat);
}

function updateStats() {
  get("score").textContent = "$" + tips;
  get("streak").textContent = streak;
}

function loseGuest(index) {
  walked++;
  walkoutStreak++;
  feedback(slots[index].person + " walked out (" + walkoutStreak + "/" + walkoutLimit + ").", "bad");
  slots[index] = null;
  streak = 0;
  renderSlot(index);
  updateStats();
  if (walkoutStreak >= walkoutLimit) finish(true);
}

function serve(index) {
  const guest = slots[index];
  const now = gameTime();
  if (!shiftOpen() || !guest) return;
  if (guest.expires <= now) {
    loseGuest(index);
    return;
  }
  if (!glass.size) {
    feedback("Add ingredients first, then tap the guest.");
    return;
  }
  const matchesOrder = glass.size === guest.recipe.mix.length && guest.recipe.mix.every((key) => glass.has(key));
  if (matchesOrder) {
    emptyGlass();
    served++;
    walkoutStreak = 0;
    streak++;
    const speedBonus = Math.floor(guest.expires - now < 0 ? 0 : 4 * (guest.expires - now) / guest.patience);
    const earned = 8 + speedBonus + Math.min(5, streak - 1);
    tips += earned;
    feedback(guest.recipe.name + " for " + guest.person + ". +$" + earned, "good");
    slots[index] = null;
    renderSlot(index);
    tone(680, .12, .04, "sine", 1020);
  } else {
    streak = 0;
    tips = Math.max(0, tips - 3);
    feedback("Wrong drink for " + guest.person + ". Your cocktail is still in the glass.", "bad");
    tone(150, .15, .032, "triangle", 94);
  }
  updateStats();
}

function tick() {
  const now = gameTime();
  if (!shiftOpen()) return;
  const elapsed = now - shiftStart;
  const nextStage = menuStages[menuStage + 1];
  if (nextStage && elapsed >= nextStage.start) {
    setMenuStage(menuStages.findLastIndex((stage) => elapsed >= stage.start));
  }
  const seconds = Math.floor(elapsed / 1000);
  if (seconds !== lastClock) {
    get("clock").textContent = formatShiftTime(seconds);
    lastClock = seconds;
  }
  for (const [index, guest] of slots.entries()) {
    if (!guest) continue;
    if (guest.expires <= now) {
      loseGuest(index);
      if (phase !== "game") return;
      continue;
    }
    const remaining = (guest.expires - now) / guest.patience;
    guest.bar.style.transform = "scaleX(" + remaining + ")";
    guest.bar.classList.toggle("low", remaining < .28);
  }
  if (now >= nextGuest) {
    seatGuest(now);
    nextGuest = now + Math.max(4500, 7000 - elapsed * .03);
  }
  frame = requestAnimationFrame(tick);
}

function shiftOpen() {
  return phase === "game" && pausedAt === null;
}

function begin() {
  tips = streak = served = walked = walkoutStreak = 0;
  lastClock = -1;
  orderedRecipes.clear();
  setMenuStage(0);
  slots.fill(null);
  slots.forEach((_, index) => renderSlot(index));
  emptyGlass();
  updateStats();
  get("menu").open = false;
  feedback("Add ingredients, then tap the guest.");
  get("intro").hidden = true;
  get("results").hidden = true;
  get("game").hidden = false;
  phase = "game";
  pausedAt = null;
  pausedDuration = 0;
  shiftStart = gameTime();
  nextGuest = shiftStart + 6500;
  seatGuest(shiftStart);
  pickTrack(shiftCount % tracks.length);
  shiftCount++;
  playSound();
  leaderboard.begin();
  tick();
  ingredientButtons.get("gin").focus({ preventScroll: true });
}

function finish(closedByWalkouts = false) {
  if (phase !== "game") return;
  const seconds = Math.floor((gameTime() - shiftStart) / 1000);
  pausedAt = null;
  phase = "results";
  cancelAnimationFrame(frame);
  music.pause();
  leaderboard.finish(served > 0 ? seconds : 0);
  const priorBest = readBestTime();
  const newBest = served > 0 && seconds > priorBest;
  if (newBest) {
    try { localStorage.setItem(bestTimeKey, String(seconds)); } catch {}
  }
  get("record").textContent = (newBest ? "NEW " : "") + "LONGEST SHIFT · " + formatShiftTime(newBest ? seconds : priorBest);
  get("summary").textContent = formatShiftTime(seconds) + " open · $" + tips + " in tips · " + served + " served · " + walked + " walked out";
  const reason = get("close-reason");
  reason.hidden = !closedByWalkouts;
  get("game").hidden = true;
  get("results").hidden = false;
  get("retry").focus({ preventScroll: true });
}

function tone(from, duration, volume, type, to, at = audio?.currentTime) {
  if (!soundOn || !audio || audio.state !== "running") return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  gain.gain.setValueAtTime(.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(at);
  oscillator.stop(at + duration);
}

function pickTrack(index) {
  trackIndex = index;
  const { title, label, file } = tracks[index];
  const source = "audio/" + encodeURIComponent(file);
  if (music.getAttribute("src") !== source) music.src = source;
  else music.currentTime = 0;
  nowPlaying.textContent = title;
  trackLabel.textContent = "Rozzo · " + label;
  musicStatus.hidden = true;
}

function playSound() {
  if (!soundOn || phase !== "game" || pausedAt !== null) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    audio ||= new AudioContext();
    audio.resume().catch(() => {});
  }
  music.play().catch((error) => {
    if (error.name !== "AbortError" && soundOn && phase === "game" && pausedAt === null && music.paused) {
      musicStatus.hidden = false;
      soundOn = false;
      updateSoundButton();
    }
  });
}

function updateSoundButton() {
  soundButton.textContent = soundOn ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-pressed", soundOn);
}

music.addEventListener("playing", () => {
  musicStatus.hidden = true;
});
music.addEventListener("ended", () => {
  pickTrack((trackIndex + 1) % tracks.length);
  playSound();
});
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn) playSound();
  else music.pause();
  updateSoundButton();
});

const pauseDialog = get("pause-dialog");
function pauseShift() {
  if (!shiftOpen()) return;
  pausedAt = performance.now();
  cancelAnimationFrame(frame);
  music.pause();
  if (audio?.state === "running") audio.suspend().catch(() => {});
  get("menu").open = false;
  get("pause-clock").textContent = get("clock").textContent;
  pauseDialog.showModal();
}

function resumeShift() {
  if (pausedAt === null) return;
  pausedDuration += performance.now() - pausedAt;
  pausedAt = null;
  pauseDialog.close();
  playSound();
  tick();
}

get("pause").addEventListener("click", pauseShift);
get("resume").addEventListener("click", resumeShift);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseShift();
});
get("close-bar").addEventListener("click", () => {
  if (pausedAt === null) return;
  pauseDialog.close();
  finish();
});
pauseDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  resumeShift();
});
get("clear").addEventListener("click", () => {
  if (!shiftOpen()) return;
  emptyGlass();
  ingredientButtons.get("gin").focus({ preventScroll: true });
});
get("start").addEventListener("click", begin);
get("retry").addEventListener("click", begin);
get("main-menu").addEventListener("click", () => {
  phase = "intro";
  get("results").hidden = true;
  get("intro").hidden = false;
  showEndlessBest();
  get("start").focus({ preventScroll: true });
});
