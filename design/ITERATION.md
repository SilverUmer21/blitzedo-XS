# Design iteration checklist

Use [DESIGN.md](../DESIGN.md) as the current source of design decisions. Add revisions as separate files so the original concepts remain available.

## Confirmed direction

- [x] Home: Play beyond, charcoal voxel b, red doorway, ivory explorer and red scarf.
- [x] Desktop Studio: detailed workbench scene.
- [x] Desktop Contact: red mailbox with envelope, columns and rubble.
- [x] Keep each game's native art style inside the studio website frame.
- [x] Recover concept artwork and connect the Markdown image references.

## Next review

- [ ] Choose Games Option A or B.
- [ ] Replace provisional game posters with artwork faithful to the real games.
- [ ] Approve mobile Home framing without simplifying the b sculpture.
- [ ] Review mobile Studio and Contact; remove numbered process markers.
- [ ] Refine wordmark, font selection, palette, buttons and form states.
- [ ] Review static layouts at 360, 390, 768 and 1440 pixels.
- [ ] Approve desktop and mobile static screens before implementation.

## Later phases

- [ ] Implement the approved website.
- [ ] Add transitions with reduced-motion alternatives.
- [ ] Define and animate the explorer mascot.

## Decision log

| Date | Decision | Status |
| --- | --- | --- |
| 2026-10-15 | Preserve the documented direction and original artwork; continue design before code. | Current foundation |
| 2026-10-15 | Deliver the remaining artwork and documentation together in one commit. | User requested |
| 2026-10-15 | Build the Home page: generated voxel b sculpture (finer stone, red rim light, glowing doorway, tapered floating foundation), primary button in `#D51D22`, clean wordmark, no active nav item on Home. | Implemented, awaiting user review |
| 2026-10-15 | Rebuild the sculpture in three.js with real cubes (big foundation blocks, pixel-art textures, shadow-casting lights, doorway light) closer to the reference. | Implemented, awaiting user review |

For each later review, record the exact file, decision, and approval status. Do not mark proposals approved without a user decision.
