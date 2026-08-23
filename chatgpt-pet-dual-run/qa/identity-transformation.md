# Dual-identity contract

Yachiyo and Kaguya are the same person at different points in her life. The Pet uses app state to switch identity while preserving one recognizable face, chibi proportion system, line quality, and animation scale.

- Yachiyo form: rows 0 idle, 1 running-right, 2 running-left, 6 waiting, and rows 9-10 look directions.
- Kaguya form: row 4 jumping and row 7 active work.
- Forward transformation: row 3 waving starts as Yachiyo, morphs hair and costume while the silhouette remains connected, then ends as Kaguya waving.
- Reverse transformation: row 8 review starts as Kaguya reviewing the result and ends as Yachiyo settled and satisfied.
- Failure recovery: row 5 starts as dejected Kaguya and returns to dejected Yachiyo in the final frames.

Transformation invariants:

- Keep the same face geometry, eye spacing, body scale, feet baseline, and overall chibi anatomy through both forms.
- Morph only attached anatomy, hair, ornaments, clothing, and footwear. No detached sparkles, aura, glow, smoke, symbols, text, shadows, or scenery.
- Intermediate frames must read as one continuous person changing identity, never as two characters standing together.
- Yachiyo remains silver-haired with looped twin tails and navy/teal kimono dress; Kaguya is warm-blonde with rabbit-ear side locks, coral-red and lime kimono, crescent hair ornament, turquoise hair beads, and rabbit-face platform shoes.
