/**
 * Grocery Grab — the grocery catalog.
 * All prices are in cents so totals stay exact integers.
 * `aisle` is the aisle the item belongs to (1–4, top to bottom).
 */

export const ITEMS = [
  { id: 'milk', name: 'Milk', emoji: '🥛', price: 349, aisle: 1 },
  { id: 'eggs', name: 'Eggs', emoji: '🥚', price: 399, aisle: 1 },
  { id: 'cheese', name: 'Cheese', emoji: '🧀', price: 499, aisle: 1 },
  { id: 'butter', name: 'Butter', emoji: '🧈', price: 449, aisle: 1 },
  { id: 'yogurt', name: 'Yogurt', emoji: '🍦', price: 329, aisle: 1 },
  { id: 'orange-juice', name: 'Orange Juice', emoji: '🧃', price: 399, aisle: 1 },
  { id: 'bread', name: 'Bread', emoji: '🍞', price: 279, aisle: 2 },
  { id: 'cereal', name: 'Cereal', emoji: '🥣', price: 449, aisle: 2 },
  { id: 'pasta', name: 'Pasta', emoji: '🍝', price: 199, aisle: 2 },
  { id: 'rice', name: 'Rice', emoji: '🍚', price: 299, aisle: 2 },
  { id: 'peanut-butter', name: 'Peanut Butter', emoji: '🥜', price: 379, aisle: 2 },
  { id: 'coffee', name: 'Coffee', emoji: '☕', price: 899, aisle: 2 },
  { id: 'pizza', name: 'Pizza', emoji: '🍕', price: 599, aisle: 3 },
  { id: 'ice-cream', name: 'Ice Cream', emoji: '🍦', price: 549, aisle: 3 },
  { id: 'chicken', name: 'Chicken', emoji: '🍗', price: 799, aisle: 3 },
  { id: 'bacon', name: 'Bacon', emoji: '🥓', price: 649, aisle: 3 },
  { id: 'tomato-sauce', name: 'Tomato Sauce', emoji: '🥫', price: 249, aisle: 3 },
  { id: 'cookies', name: 'Cookies', emoji: '🍪', price: 349, aisle: 3 },
  { id: 'apples', name: 'Apples', emoji: '🍎', price: 299, aisle: 4 },
  { id: 'bananas', name: 'Bananas', emoji: '🍌', price: 199, aisle: 4 },
  { id: 'carrots', name: 'Carrots', emoji: '🥕', price: 179, aisle: 4 },
  { id: 'grapes', name: 'Grapes', emoji: '🍇', price: 399, aisle: 4 },
  { id: 'chips', name: 'Chips', emoji: '🥔', price: 329, aisle: 4 },
  { id: 'soda', name: 'Soda', emoji: '🥤', price: 499, aisle: 4 },
];

/** Big-ticket bonus items hidden around the store each run. */
export const BONUS_ITEMS = [
  { id: 'golden-turkey', name: 'Golden Turkey', emoji: '🦃', price: 2500, bonus: true },
  { id: 'giant-ham', name: 'Giant Ham', emoji: '🍖', price: 2000, bonus: true },
  { id: 'mega-cake', name: 'Mega Cake', emoji: '🎂', price: 1500, bonus: true },
];

/** The per-item bonus for grabbing something on the shopping list. */
export const LIST_BONUS_CENTS = 200;

/** Extra bonus for finding every item on the list. */
export const LIST_COMPLETE_BONUS_CENTS = 500;

/** Time bonus paid per whole second left when checking out early. */
export const TIME_BONUS_PER_SECOND_CENTS = 25;

export const LIST_SIZE = 6;

export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A fresh shopping list: 6 different items, each with a `found` flag. */
export function makeShoppingList() {
  return shuffle(ITEMS)
    .slice(0, LIST_SIZE)
    .map((item) => ({ ...item, found: false }));
}

/** "$4.49" style money from integer cents. */
export function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
