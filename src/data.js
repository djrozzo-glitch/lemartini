export const ingredients = {
  gin: ["Gin", "#b8cddb"], vermouth: ["Vermouth", "#e7cf8b"],
  olive: ["Olive", "#bfc969"], campari: ["Campari", "#f38488"],
  vodka: ["Vodka", "#b5a8e0"], grenadine: ["Grenadine", "#ee5373"],
  tabasco: ["Tabasco", "#ff8d60"], whiskey: ["Whiskey", "#d6a163"],
  tequila: ["Tequila", "#eac582"], rum: ["Rum", "#d59c7b"],
};
export const menuStages = [
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
export const tracks = [
  { title: "Le Martini", label: "See the Sea Records", file: "rozzo – le martini [See the Sea Records].mp3" },
  { title: "No But No", label: "See the Sea Records", file: "rozzo – no but no [See the Sea Records].mp3" },
];
export function formatShiftTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const tail = String(seconds % 60).padStart(2, "0");
  if (minutes < 60) return minutes + ":" + tail;
  return Math.floor(minutes / 60) + ":" + String(minutes % 60).padStart(2, "0") + ":" + tail;
}

