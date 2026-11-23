# First appearance of the titan wrecks

The experiment starts from `44935d2`. During battle entry it mounts the two hulls and their instanced pines behind a hidden group at structure level 4. With hardware WebGL and parallel shader compilation, it prepares both materials using the actual scene lights and tree instance colors. The group becomes visible at structure level 5, corresponding to streaming stage 10 on the tested route. Software WebGL, overview mode and hardware without the extension use the ordinary visible mount.

## Diagnosis

Cold Radeon 780M traces reproduced the stall on the same short drive with and without a shot. On main, JavaScript spent 243 and 245 ms in the first hull `getProgramInfoLog` call during draw submission. The first pine submission spent 141 and 172 ms there, and the following pine submission another 135 and 144 ms. In these two runs, hull geometry construction took 30 ms, bump texture setup about 1 ms and pine geometry about 2 ms. Creating the hull material object took less than 1 ms. These are wall-clock measurements of CPU-side calls, including driver waits. They support preparing the programs ahead of first use.

## Cold paired comparison

Chrome, ANGLE D3D11, Radeon 780M, 1100 × 730, balanced quality, fixed resolution scale 0.85. Network emulation used 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Each run used a fresh browser profile and the same four baked world assets by SHA-256. Both builds had identical timing probes. Only separate diagnostic runs wrapped WebGL calls.

The driver clicked battle from the first overview, held W until the mech moved at least one world unit, then released W. For the firing route it pressed Space on reaching stage 10 and released it when the shot counter advanced. The other route followed the same movement without firing. Each route ran four cold pairs, alternating which build ran first. Frame intervals are measured between consecutive main-scene render completions. The reveal is the first actual color draw of the hull.

| Median across eight pairs | Main | Candidate |
| --- | ---: | ---: |
| Click to first controllable frame | 4.938 s | 5.137 s |
| Longest frame from control through reveal | 957 ms | 530 ms |
| Reveal frame | 957 ms | 499 ms |
| First color draw of hull / pines | 242 / 151 ms | 32 / 2 ms |
| Time from control until reveal | 3.023 s | 2.249 s |
| Longest frame from control through stage 16 | 1,413 ms | 1,423 ms |

The peak through reveal fell in every pair. Without a shot its median fell from 961 to 527 ms. With a shot it fell from 942 to 534 ms. All 16 runs showed the wrecks on stage 10 and recorded their largest full-route frame on stage 14.

The candidate began preparing the geometry 259–1,384 ms after control in these runs. Control coincided with stage 5 in seven candidate runs and four control runs. Among the five pairs reaching control on the same stage, the median paired entry difference was −64 ms. Background load varied, with peak external 3D utilization during entry reaching 17%. The overall entry result includes this scheduling variability. [Measurements for every pair](titan-wreck-entry.csv)

## Entry-only follow-up

Four more alternating cold pairs ended at the game's control mark. These used the same network and graphics settings, without per-frame or per-draw hooks. The machine continued to run other workloads. None of the eight starts met the pre-launch quiet condition of three recent samples with external CPU at or below 30% and external 3D at or below 8% within the 12-second wait.

| Pair in execution order | Main, ms (stage) | Candidate, ms (stage) |
| --- | ---: | ---: |
| A, main first | 4,973 (4) | 5,282 (5) |
| B, candidate first | 5,138 (5) | 5,168 (5) |
| C, candidate first | 5,304 (5) | 5,136 (5) |
| D, main first | 5,143 (5) | 4,614 (4) |

Median entry time was 5.141 s on main and 5.152 s with preparation. The 199 ms difference in the route series fell to 11 ms in the follow-up. An idle-machine test is still needed to establish entry-time equivalence. The remaining peak on stage 14 merits a separate trace.

Separate browser checks compared the rendered scene after reveal on main, on the candidate, and on the candidate with the parallel compilation extension disabled. The hull and pine geometry attributes and indices, eight tree instance matrices and colors, material program keys, and shadow flags matched across all three. The candidate mounted the hidden group early only with the extension available. All three completed the route without browser errors.
