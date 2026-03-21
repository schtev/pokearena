# PokéArena — Trainer Sprites

Drop cut sprites into this folder and the game uses them automatically.
The game works without them — it falls back to canvas-drawn portraits.

---

## Getting the sprites

**Step 1 — Download the sheet**

Go to The Spriters Resource and download the FireRed/LeafGreen trainer sheet:
https://www.spriters-resource.com/game_boy_gbc/pokemonredblue/

Save it as `trainers-sheet.png` anywhere on your computer.

**Step 2 — Install the cutter's dependency**

```
npm install jimp
```

**Step 3 — Run the cutter**

```
node tools/cutSprites.js path/to/trainers-sheet.png
```

This cuts every sprite from the sheet, removes the orange background,
and saves individual transparent PNGs into `sprites/trainers/`.

---

## What gets cut

The tool outputs these files (used directly in-game):

| File | Character |
|------|-----------|
| `brock.png` | Brock (Pewter Gym) |
| `misty.png` | Misty (Cerulean Gym) |
| `ltsurge.png` | Lt. Surge (Vermilion Gym) |
| `erika.png` | Erika (Celadon Gym) |
| `koga.png` | Koga (Fuchsia Gym) |
| `sabrina.png` | Sabrina (Saffron Gym) |
| `blaine.png` | Blaine (Cinnabar Gym) |
| `giovanni.png` | Giovanni (Viridian Gym) |
| `lorelei.png` | Lorelei (Elite Four) |
| `bruno.png` | Bruno (Elite Four) |
| `youngster.png` | Youngster |
| `lass.png` | Lass |
| `bugcatcher.png` | Bug Catcher |
| `hiker.png` | Hiker |
| `red.png` | Red (player) |
| `rival.png` | Blue/Gary |
| ...and more |

---

## Folder structure

```
sprites/
  trainers/    ← cut sprites go here
  overworld/   ← (optional) overworld walking sprites
```
