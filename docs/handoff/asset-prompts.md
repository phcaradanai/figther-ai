# Hunyuan3D prompts for the hero assets

Generate on https://hy3d.tencent.ai/ and download **GLB with textures**. Save each hero's
files to `art/source/<heroId>/` with these names (the rig pipeline in `tools/rig/` expects them):

| File | What | Rig use |
|---|---|---|
| `body.glb` | Hero in their outfit (= the armor slot) | skinned to the shared skeleton |
| `helmet.glb` | Helmet / hat / headband | rigid on the `head` bone |
| `weapon.glb` | One weapon (paired weapons: generate one, it gets mirrored) | rigid on `handR` (and `handL`) |
| `trinket.glb` | Back/side item (only where listed) | rigid on `torso` or floating |

Capes and scarves (knight, ninja, mage, cowboy, witch, reaper) are built and skinned in
Blender so they move, so there are no prompts for them.

## Rules for every body

Paste this **shared style block** first, then the hero line, so all ten heroes come out
with the same proportions and pose (the shared skeleton depends on it):

```
Stylized fantasy MMORPG hero, hand-painted soft textures, young character with large anime eyes, head about one quarter of total height, full body, standing straight in A-pose with arms angled 45 degrees away from the body, legs slightly apart, facing front, empty open hands, no weapon, no helmet, no hat, no cape, no base,
```

If the result has the arms against the body, a weapon in hand, or a crouched or twisted
stance, regenerate it: those are what make rigging fail. Skirts and robes should stay knee-length or
shorter so the legs can bend.

For helmets, weapons and trinkets, end every prompt with:

```
hand-painted MMORPG style texture, single object, centered, no character, no base
```

---

## knight (Iron Knight, sword and shield)

- body: `young paladin knight, short light-brown hair, ornate silver plate armor with gold trim, royal blue cloth tabard, armored gauntlets and boots`
- helmet: `paladin open-face helmet, silver with gold trim and small gold wings on the sides, empty inside`
- weapon: `paladin longsword, silver blade, gold cross-shaped guard with a blue gem, leather grip, straight and vertical`
- trinket (shield): `paladin kite shield, silver rim, royal blue face with a gold cross emblem, front view`

## ninja (Shadow Ninja, dual kunai)

- body: `young shadow ninja, spiky purple-black hair, fitted dark navy-purple shinobi outfit with violet trim, wrapped forearm guards, waist sash with small pouches, tabi boots`
- helmet: `shinobi forehead protector headband with an engraved metal plate and two long trailing cloth ties`
- weapon: `kunai dagger, black steel blade, violet wrapped handle with a ring pommel, straight`

## mage (Fire Archmage, fire staff)

- body: `young fire archmage, wavy auburn hair, knee-length crimson robe with gold trim, layered sleeves, leather belt with a gold buckle, brown boots`
- helmet: `wide-brim crimson wizard hat with a gold band and a small flame emblem, empty inside`
- weapon: `fire staff, dark wood shaft with gold fittings, glowing orange flame crystal at the top, straight and vertical`
- trinket: `small floating fire orb inside a thin gold ring, glowing orange`

## cowboy (Desperado Cowboy, dual revolvers)

- body: `young desperado cowboy, wavy brown hair, cream linen shirt, brown leather vest with a gold star badge, gun belt with two empty holsters, brown leather chaps, boots with spurs`
- helmet: `brown leather cowboy hat with a braided band and a small gold star, empty inside`
- weapon: `western six-shooter revolver, dark steel with brass details and a wooden grip`

## samurai (Samurai, katana)

- body: `young samurai, black hair tied in a topknot, dark charcoal kimono with crimson trim, red lacquered shoulder and waist armor plates, hakama trousers ending above the ankle, tabi socks with straw sandals`
- helmet: `samurai kabuto helmet, black lacquer with red cords and a gold crescent crest, empty inside`
- weapon: `katana, polished steel blade, gold round guard, red-wrapped handle, straight` (the katana example `D:\3D-Models\1127c3...glb` can be used instead)
- trinket: `samurai sashimono back banner, crimson flag with a white circle on a thin black pole`

## witch (Frost Ice Witch, ice wand)

- body: `young frost witch, long silver-white hair, deep navy blue dress with icy cyan trim and frost patterns, knee-length skirt, white gloves, blue boots`
- helmet: `pointed witch hat, navy blue with an icy cyan band and a snowflake emblem, empty inside`
- weapon: `ice wand, silver handle, large icy blue crystal tip with small frost spikes, straight`
- trinket: `small floating ice crystal familiar, three cyan shards orbiting a glowing core`

## cyborg (Cyborg, plasma rifle)

- body: `young cyborg soldier, short silver-blue hair, sleek white armored bodysuit with orange panels and thin glowing cyan lines, mechanical forearm plates, armored boots`
- helmet: `sci-fi visor headset, white and orange, glowing cyan visor across the eyes`
- weapon: `compact sci-fi plasma rifle, white and orange casing, glowing cyan energy core, side view`
- trinket: `compact sci-fi jetpack, white and orange, two thruster nozzles pointing down, back view`

## viking (Viking Berserker, twin axes)

- body: `young viking berserker, copper-red braided hair, brown leather tunic with a fur collar, iron arm bracers, belt with a rune buckle, fur-wrapped boots, sturdy build`
- helmet: `viking helmet, iron with bronze trim and two short curved horns, empty inside`
- weapon: `bearded viking hand axe, iron head with rune engravings, leather-wrapped wooden handle, straight`
- trinket: `round viking shield, wooden planks with an iron rim and a central iron boss, painted orange stripe`

## striker (Muay Thai Striker, gauntlets)

- body: `young muay thai fighter, spiky brown hair, sleeveless golden-yellow top with red trim, red muay thai shorts with gold lettering, red ankle wraps, bare wrapped hands`
- helmet: `muay thai mongkhon sacred headband, braided red and gold rope ring with a short tail`
- weapon: `single armored fighting gauntlet for the right hand, gold plating with red leather padding, fist closed`
- trinket: `championship belt, wide gold plate with a red gem in the center on a red leather strap, laid flat`

## reaper (Necro Grim Reaper, scythe)

- body: `young grim reaper, long pale lavender-grey hair, dark purple robe with tattered knee-length hem and lilac trim, silver skull shoulder clasp, dark boots`
- helmet: `tattered dark purple hood with a small silver skull clasp, empty inside`
- weapon: `grim reaper scythe, long black shaft, large curved dark steel blade with glowing purple runes`
- trinket: `small floating soul lantern, dark iron cage with a glowing violet flame inside`
