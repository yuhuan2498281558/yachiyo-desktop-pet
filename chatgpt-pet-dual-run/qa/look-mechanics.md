# Yachiyo look-direction mechanics

- Keep both feet and the lower-body baseline anchored inside the same 192x208 cell. Do not rotate or translate the whole sprite.
- Let the eyes and eyelids lead each direction, followed by a small head and neck turn. Add only subtle upper-torso follow-through.
- Twin tails, ring ornaments, colored hair streaks, wide sleeves, layered skirt, and the magenta octopus chest ornament must remain attached and keep their canonical shapes and colors.
- `000` (up): pupils and chin point upward; forehead becomes slightly more visible.
- `090` (screen-right): eyes and face turn clearly to screen-right, with a restrained three-quarter head turn.
- `180` (down): pupils and chin point downward; upper eyelids lower slightly without changing identity.
- `270` (screen-left): mirror the directional meaning of `090` while preserving costume identity and accessories.
- Intermediate angles must progress clockwise in even 22.5-degree steps. Avoid skull warping, face sliding, limb movement, whole-body rotation, or large silhouette changes.
