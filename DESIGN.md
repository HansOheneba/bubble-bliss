# Bubble Bliss Admin: design notes

**Who and what.** The owner, usually on a phone, usually between 6pm and 10pm while the shop is busy. The till runs on the POS tablet, so this is not where orders get made. The questions it answers: how are we doing tonight, does the money add up, is anything wrong, and can I fix a price or mark something sold out quickly?

**One primary thing per screen.**
- Today: tonight's takings, and whether they add up.
- Orders: find an order and fix it.
- Sales: how the business is trending.
- Menu: change what is for sale.
- Team: who can use the till.

**The reference.** The end-of-night cash-up sheet and the thermal till receipt. One big total, dotted leaders running to amounts, dashed rules between sections, sentences instead of stat tiles.

**It must never look like** a generic SaaS dashboard: no grids of KPI cards, no donut charts, no eyebrow labels, no tables that scroll sideways on a phone.

## Type
- Display: Bricolage Grotesque. Page titles, section titles and big totals only.
- Text: Instrument Sans. Everything else. Money uses tabular numbers.
- Fonts are local files in `app/fonts`, loaded with `next/font/local`.

## Colour (tokens in `app/globals.css`)
- `background`, `card`, `border`: milk tea by day, brown sugar by night. Always warm, never neutral grey.
- `primary`: berry from the logo. Actions and the current place only.
- `attention`: caramel. Something needs a look.
- `good`: matcha. Ahead, paid, cash.
- `destructive`: red. Cancel and delete only.

## Components
- `Ledger` and `LedgerRow`: label, dotted leader, value. The core pattern.
- `Rule`: the dashed divider.
- Buttons: 6px corners, one primary per screen, press scales to 0.97.
- Icons: lucide only, in navigation and where a word would not fit.

## Motion
Short and functional. Press feedback, a top progress line while a page loads, sheets from shadcn. Respects reduced motion.

## Speed rules
1. Pages only load the period on screen, and send totals to the browser, not raw orders.
2. Filters are links or URL changes. Nothing refetches on a keystroke until the 300ms debounce.
3. No link prefetching. Every order list is limited, with Load more.
4. Charts are plain CSS, no chart library on these screens.
