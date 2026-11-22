# Deferred combat effects

This experiment moves eight effect renderers into one dynamic import. On the streaming overview path the game starts the import alongside full-world loading after the first overview draw. Direct battle entry requests the module alongside world data. The detailed scene receives the loaded components together, so the first controllable frame can render tracers, flashes and casings. Pool ownership and effect update logic are unchanged.

## Payload and method

The production manifest placed only the entry JS on the initial static import path in both builds. Against main at `02946da`, the minified entry fell from 1,922,847 to 1,884,141 bytes. Chrome Resource Timing measured gzip body sizes of 540,511 and 530,065 bytes, a reduction of 10,446 bytes (1.93%). Fetching the 11,826-byte effect module later adds 1,380 bytes to the combined JS bodies.

Each of twelve pairs used fresh Chrome profiles on a Radeon 780M, balanced graphics, gzip serving and CDP network emulation at 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Alternating the variant order limits order bias. A DOM observer clicked the first visible enabled battle button as soon as the overview had drawn. All clicks occurred before full-world readiness. All candidate runs requested the effect chunk once, after the overview draw. At the first controllable frame the scene already contained the tracer, flash, casing and debris renderers.

Other workloads were active during several of the first eight pairs. Each session in pairs 9–12 waited for a six-second lower-load window before launch. The external 3D engine sampled less than 3% in those four pairs during both measured phases. The CSV includes external system load measured during the tests. CPU and GPU columns exclude the benchmark browser process tree. GPU values are sampled maxima at approximately half-second intervals.

| Median across the four lower-load pairs | Main | Deferred |
| --- | ---: | ---: |
| Navigation to first overview draw | 1,445 ms | 1,446 ms |
| Immediate battle click to controllable frame | 7,192 ms | 7,188 ms |

The individual paired differences for the overview were −7, +4, +10 and −9 ms. For click to control they were +184, +96, −102 and +69 ms (candidate minus main). Across all twelve pairs the median paired differences were −7 ms for the overview and +62 ms for battle entry. The payload saving did not produce a repeatable first-frame win. Keep the change experimental.

For the main build in the four lower-load pairs, the median wait from click to full-world readiness was 4.13 s. The median from that mark to the controllable frame was another 3.07 s. These two intervals are larger candidates for investigation. A direct-entry smoke run reached control. In a separate run the effects request was blocked and then unblocked, the existing details retry button restored the scene, and the first burst produced visible instances in all three tracer, flash and casing pools. [All paired measurements](deferred-combat-effects.csv)
