# Sprite generation record

Generation mode: built-in `image_gen` tool, followed by local chroma-key removal.

The three input images were local reference frames extracted from the user's
copy of the movie. They were used only for character identity, costume, palette,
and silhouette, and are not distributed with this project.

## Final prompt

```text
Use case: stylized-concept
Asset type: 2x2 desktop-pet animation pose sheet for a Windows transparent overlay
Input images: the three supplied movie frames are reference images for the same character's identity, costume, palette, and silhouette; do not copy the frames or backgrounds
Primary request: redraw the silver-haired virtual singer Yachiyo from the reference images as a charming polished chibi desktop pet, shown in exactly four clearly separated full-body poses in a clean 2x2 grid: top-left calm standing idle with a soft smile, top-right cheerful wave, bottom-left small energetic hop with both feet visible, bottom-right curled-up sleepy sitting pose
Subject details: very long silver-white twin tails with subtle cyan and pink accents, two loop-shaped hair ornaments, dark navy oversized kimono sleeves, turquoise layered skirt, magenta octopus-shaped chest ornament, Japanese ocean-creature visual motifs; preserve these distinctive outfit details and keep the character consistent across all four poses
Style/medium: crisp modern 2D anime game sprite, expressive chibi proportions, clean dark linework, subtle cel shading, production-ready sprite art
Composition/framing: square canvas, each pose centered in its own equal quadrant at the same visual scale, generous empty space around every pose, no pose crosses a quadrant boundary, no dividers or panel lines
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background across the entire image for background removal; one uniform color only, with no shadows, gradients, texture, reflections, floor plane, or lighting variation
Constraints: no text, no captions, no logo, no watermark; no extra characters; no cropped hair, hands, clothes, or feet; do not use #00ff00 anywhere in the character; no cast shadow, contact shadow, glow, particles, or translucent effects; keep all four poses stylistically and anatomically consistent
```

