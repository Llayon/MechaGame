# MechaGame industrial audio — CC0 provenance

Source recordings and credits are listed below; generated `SOURCES.json`
contains per-file hashes and preview URLs. All audio is bundled in the
game itself, so no gameplay requests go to Freesound or Kenney.

- **AugustSandberg**, Diesel Engine: https://freesound.org/people/AugustSandberg/sounds/237292/ — CC0.
- **pgi**, mech_step_002 (primary heavy footstep): https://freesound.org/people/pgi/sounds/213041/ — CC0; same recording on Pixabay: https://pixabay.com/sound-effects/film-special-effects-mech-step-002-87150/.
- **Breviceps**, Battle Mech walks (fallback footsteps): https://freesound.org/people/Breviceps/sounds/557594/ — CC0.
- **nuckan**, hydraulics.wav: https://freesound.org/people/nuckan/sounds/212941/ — CC0.
- **ShawnyBoy**, Heavy Machine Gun: https://freesound.org/people/ShawnyBoy/sounds/165394/ — CC0.
- **GaryQ**, Tank fire Mixed: https://freesound.org/people/GaryQ/sounds/127845/ — CC0.
- **Kenney**, Impact Sounds: https://kenney.nl/assets/impact-sounds — CC0.

For Freesound the import script uses public HQ preview files, not the
authenticated original WAV download. Every clip is edited and compressed to
mono OGG Vorbis 32 kHz plus a matching 96 kbps MP3 for older iOS Safari.
The browser prefers OGG when fully supported, otherwise MP3, and retries
the alternate codec if decoding fails. The audio engine does not use any paid API.

The audio mixer uses dynamic compression and an upper voice budget; IK foot
contacts play pgi's exact mech_step_002 (tiny randomized pitch shift and
low-pass in water, with no additional metallic thud layer). The original
Breviceps steps remain fallback only while the new step is loading or if
it is unavailable. Footsteps off the ground drive real
hydraulic foley, and the diesel loop changes pitch and EQ with movement load.
These source clips are intentionally short prototype selections, not recordings
of the fictional vehicle itself. Tune the mix by listening in Chrome and Safari.
