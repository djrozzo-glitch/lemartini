import { ingredients, menuStages } from "./data.js";
import { barAssets } from "./assets.js";

const regulars = Object.keys(barAssets.guests);
export const walkoutLimit = 5;

export function createShift(random = Math.random) {
  const pick = items => items[Math.floor(random() * items.length)];
  const ordered = new Set();
  let nextGuest = 6500;
  let guestId = 0;
  const state = {
    slots: [null, null, null], glass: [], elapsed: 0, stage: 0, tips: 0,
    streak: 0, served: 0, walked: 0, walkoutStreak: 0, closed: false,
    feedback: { text: "Add ingredients, then tap the guest." },
  };

  function seatGuest() {
    const seat = state.slots.indexOf(null);
    if (seat < 0) return;
    const stages = menuStages.slice(0, state.stage + 1);
    const activeNames = new Set(state.slots.filter(Boolean).map(guest => guest.person));
    const activeOrders = new Set(state.slots.filter(Boolean).map(guest => guest.recipe));
    const options = stages.flatMap(stage => stage.recipes).filter(recipe => !activeOrders.has(recipe));
    const newOrders = options.filter(recipe => !ordered.has(recipe));
    const recipe = stages.map(stage => stage.recipes[0]).find(order => !ordered.has(order))
      ?? pick(newOrders.length ? newOrders : options);
    const patience = Math.max(22000, 29000 - state.elapsed * .09) + 3000 * Math.max(0, recipe.mix.length - 3);
    ordered.add(recipe);
    state.slots[seat] = {
      id: ++guestId, person: pick(regulars.filter(person => !activeNames.has(person))),
      recipe, patience, expires: state.elapsed + patience,
    };
  }

  function feedback(text, kind = "") {
    state.feedback = { text, kind };
  }

  function loseGuest(index) {
    const guest = state.slots[index];
    state.slots[index] = null;
    state.walked++;
    state.walkoutStreak++;
    state.streak = 0;
    feedback(guest.person + " walked out (" + state.walkoutStreak + "/" + walkoutLimit + ").", "bad");
    state.closed = state.walkoutStreak >= walkoutLimit;
  }

  function advance(elapsed) {
    if (state.closed) return;
    state.elapsed = elapsed;
    state.stage = menuStages.findLastIndex(stage => stage.start <= elapsed);
    for (const [index, guest] of state.slots.entries()) {
      if (guest && guest.expires <= elapsed) loseGuest(index);
      if (state.closed) return;
    }
    if (elapsed >= nextGuest) {
      seatGuest();
      nextGuest = elapsed + Math.max(4500, 7000 - elapsed * .03);
    }
  }

  function add(key) {
    if (!ingredients[key]) return;
    state.glass = state.glass.includes(key) ? state.glass.filter(item => item !== key) : [...state.glass, key];
  }

  function clear() { state.glass = []; }

  function serve(index, elapsed) {
    const guest = state.slots[index];
    if (state.closed || !guest) return;
    if (guest.expires <= elapsed) {
      state.elapsed = elapsed;
      loseGuest(index);
      return;
    }
    if (!state.glass.length) {
      feedback("Add ingredients first, then tap the guest.");
      return;
    }
    if (state.glass.length !== guest.recipe.mix.length || !guest.recipe.mix.every(key => state.glass.includes(key))) {
      state.streak = 0;
      state.tips = Math.max(0, state.tips - 3);
      feedback("Wrong drink for " + guest.person + ". Your cocktail is still in the glass.", "bad");
      return "bad";
    }
    clear();
    state.served++;
    state.walkoutStreak = 0;
    state.streak++;
    const speedBonus = Math.floor(4 * (guest.expires - elapsed) / guest.patience);
    const earned = 8 + speedBonus + Math.min(5, state.streak - 1);
    state.tips += earned;
    feedback(guest.recipe.name + " for " + guest.person + ". +$" + earned, "good");
    state.slots[index] = null;
    return "good";
  }

  seatGuest();
  return { read: () => ({ ...state, slots: [...state.slots] }), advance, add, clear, serve };
}
