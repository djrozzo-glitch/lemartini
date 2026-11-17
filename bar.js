"use strict";

const ingredients = {
  gin: ["Gin", "#b8cddb"], vermouth: ["Vermouth", "#e7cf8b"],
  olive: ["Olive", "#bfc969"], campari: ["Campari", "#f38488"],
  vodka: ["Vodka", "#b5a8e0"], coffee: ["Coffee", "#bf8e70"],
  lime: ["Lime", "#c7de91"], soda: ["Soda", "#8bd8ca"],
  grenadine: ["Grenadine", "#ee5373"], tabasco: ["Tabasco", "#ff8d60"],
  tequila: ["Tequila", "#eac582"], orange: ["Orange Juice", "#ffab61"],
  rum: ["Rum", "#d59c7b"], cola: ["Cola", "#b28576"],
  tripleSec: ["Triple Sec", "#ffc67f"], whiskey: ["Whiskey", "#d6a163"],
  lemon: ["Lemon", "#f1de8f"], syrup: ["Syrup", "#ecc6db"],
  gingerBeer: ["Ginger Beer", "#d9bc75"], tonic: ["Tonic", "#acded8"],
  energy: ["Energy Drink", "#d9ed87"],
};
const menuStages = [
  { start: 0, recipes: [
    { name: "Le Martini", mix: ["gin", "vermouth", "olive"] },
    { name: "Negroni", mix: ["gin", "vermouth", "campari"] },
    { name: "Espresso Martini", mix: ["vodka", "coffee"] },
    { name: "Gin Rickey", mix: ["gin", "lime", "soda"] },
  ] },
  { start: 20_000, recipes: [
    { name: "Bloody Boyarsky", mix: ["vodka", "grenadine", "tabasco"] },
    { name: "Tequila Sunrise", mix: ["tequila", "orange", "grenadine"] },
    { name: "Cuba Libre", mix: ["rum", "cola", "lime"] },
    { name: "Margarita", mix: ["tequila", "tripleSec", "lime"] },
    { name: "Dirty Spreadsheet", mix: ["vodka", "coffee", "cola"] },
    { name: "A Shot in the Dark", mix: ["rum", "coffee", "grenadine"] },
  ] },
  { start: 42_000, recipes: [
    { name: "Fall of Christianity", mix: ["vodka", "whiskey", "tequila", "rum"] },
    { name: "Moscow Mule", mix: ["vodka", "lime", "gingerBeer"] },
    { name: "Whiskey Sour", mix: ["whiskey", "lemon", "syrup"] },
    { name: "Gin & Tonic", mix: ["gin", "tonic", "lime"] },
    { name: "Error 404", mix: ["rum", "cola", "coffee"] },
    { name: "Afterparty", mix: ["vodka", "energy", "lime"] },
  ] },
];
const regulars = Object.keys(barAssets.guests);
const get = (id) => document.getElementById(id);
const shiftLength = 90_000;
const bestKey = "le-martini-best";
const slots = Array(3).fill(null);
const guestButtons = [];
const ingredientButtons = new Map();
const glass = new Set();
const orderedRecipes = new Set();
let phase = "intro";
let tips = 0, streak = 0, served = 0, walked = 0, best = 0;
let shiftStart = 0, nextGuest = 0, frame = 0;
let lastClock = -1;
let menuStage = 0;
let availableRecipes = [];
let soundOn = false, audio, beatTimer, beat = 0, nextBeat = 0;
try { best = Number(localStorage.getItem(bestKey)) || 0; } catch {}
if (best) {
  get("intro-best").textContent = "House record $" + best;
  get("intro-best").hidden = false;
}

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
  row.append(sprite(barAssets.cocktails[recipe.name].image, "recipe-image"), copy);
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
    sprite(barAssets.cocktails[guest.recipe.name].image, "order-image"),
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
  feedback(slots[index].person + " got tired of waiting.", "bad");
  slots[index] = null;
  streak = 0;
  renderSlot(index);
  updateStats();
}

function serve(index) {
  const guest = slots[index];
  const now = performance.now();
  if (!shiftOpen(now) || !guest) return;
  if (guest.expires <= now) {
    loseGuest(index);
    return;
  }
  if (!glass.size) {
    feedback("Add ingredients first, then tap the guest.");
    return;
  }
  const matchesOrder = glass.size === guest.recipe.mix.length && guest.recipe.mix.every((key) => glass.has(key));
  emptyGlass();
  if (matchesOrder) {
    served++;
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
    feedback("Wrong drink. " + guest.person + " is still waiting.", "bad");
    tone(150, .15, .032, "triangle", 94);
  }
  updateStats();
}

function tick(now) {
  if (!shiftOpen(now)) return;
  const elapsed = now - shiftStart;
  const nextStage = menuStages[menuStage + 1];
  if (nextStage && elapsed >= nextStage.start) {
    setMenuStage(menuStages.findLastIndex((stage) => elapsed >= stage.start));
  }
  const seconds = Math.ceil((shiftLength - elapsed) / 1000);
  if (seconds !== lastClock) {
    get("clock").textContent = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2,"0");
    get("clock").classList.toggle("urgent", seconds <= 10);
    lastClock = seconds;
  }
  slots.forEach((guest, index) => {
    if (!guest) return;
    if (guest.expires <= now) { loseGuest(index); return; }
    const remaining = (guest.expires - now) / guest.patience;
    guest.bar.style.transform = "scaleX(" + remaining + ")";
    guest.bar.classList.toggle("low", remaining < .28);
  });
  if (now >= nextGuest) {
    seatGuest(now);
    nextGuest = now + Math.max(4500, 7000 - elapsed * .03);
  }
  frame = requestAnimationFrame(tick);
}

function shiftOpen(now = performance.now()) {
  if (phase !== "game") return false;
  if (now >= shiftStart + shiftLength) {
    finish();
    return false;
  }
  return true;
}

function begin() {
  tips = streak = served = walked = 0;
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
  shiftStart = performance.now();
  nextGuest = shiftStart + 6500;
  seatGuest(shiftStart);
  if (soundOn) startBeat();
  tick(shiftStart);
  ingredientButtons.get("gin").focus({ preventScroll: true });
}

function finish() {
  phase = "results";
  cancelAnimationFrame(frame);
  stopBeat();
  const newBest = tips > best;
  best = Math.max(best, tips);
  try { localStorage.setItem(bestKey, String(best)); } catch {}
  get("record").textContent = (newBest ? "NEW HOUSE RECORD" : "HOUSE RECORD") + " · $" + best;
  get("summary").textContent = "$" + tips + " in tips · " + served + " served · " + walked + " walked out";
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

function startBeat() {
  if (!audio || beatTimer) return;
  const stepSeconds = 60 / 124 / 2;
  beat = 0;
  nextBeat = audio.currentTime + .035;
  const schedule = () => {
    if (audio.state !== "running") return;
    if (nextBeat < audio.currentTime) nextBeat = audio.currentTime + .035;
    while (nextBeat < audio.currentTime + .08) {
      if (beat % 2 === 0) tone(108,.15,.085,"sine",43,nextBeat);
      else {
        tone(1700,.039,.013,"triangle",1270,nextBeat);
        const root = [55,55,65.41,49][Math.floor(beat / 8) % 4];
        tone(root,.19,.043,"triangle",root,nextBeat);
      }
      beat++;
      nextBeat += stepSeconds;
    }
  };
  schedule();
  beatTimer = setInterval(schedule,25);
}

function stopBeat() {
  clearInterval(beatTimer);
  beatTimer = null;
}

get("sound").addEventListener("click", async () => {
  if (!soundOn) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      get("sound").textContent = "Sound unavailable";
      return;
    }
    try {
      audio ||= new AudioContext();
      await audio.resume();
    } catch {
      get("sound").textContent = "Sound unavailable";
      return;
    }
    soundOn = true;
    if (phase === "game") startBeat();
    else tone(510,.075,.025,"sine",680);
  } else {
    soundOn = false;
    stopBeat();
    audio.suspend().catch(() => {});
  }
  get("sound").textContent = soundOn ? "Sound on" : "Sound off";
  get("sound").setAttribute("aria-pressed", soundOn);
});
get("clear").addEventListener("click", () => {
  if (!shiftOpen()) return;
  emptyGlass();
  ingredientButtons.get("gin").focus({ preventScroll: true });
});
get("start").addEventListener("click", begin);
get("retry").addEventListener("click", begin);
