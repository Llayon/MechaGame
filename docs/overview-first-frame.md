# Cold map startup

The production HTML now loads the Google Fonts stylesheet with nonmatching screen media, then applies it on load. Browser fallback fonts can appear briefly while the existing web fonts load. The game, scene geometry and font families are the same. Open a production build with `?startupTrace&graphics=balanced` to record the entry module and completion of each overview asset group alongside the existing canvas, first-draw and full-world marks.

## Why the stylesheet matters

On the reference revision `584a6df`, the world-assets Vite plugin already injects early fetch preloads for the compact mesh, landmark geometry, landmark colors and ground texture. In a cold diagnostic trace the browser received all four by 96 ms and the entry JS by 106 ms. It received the Google Fonts CSS at 958 ms and began evaluating the entry module at 960 ms. The game then decoded the overview assets, created the canvas and submitted the first render. The font stylesheet was holding up JS execution even though the overview did not depend on the fonts.

Two diagnostic traces included compositor screenshots. The first sampled image showing the map was at 1,900 ms with the original link and 776 ms with asynchronous fonts. The corresponding first-draw marks were at 1,774 and 756 ms. Both first-map screenshots had identical RGB pixels at the trace resolution of 498 × 292. Screenshot timestamps are samples, while the render mark records scene submission.

## Measurement procedure

Use one Vite production build for both variants. Serve its files with compressed JS and CSS. For the control HTML remove just the font link's `media` and `onload` attributes, leaving the existing preloads and all other responses identical. Use a fresh Chrome process and profile for every navigation, keep caching enabled within that navigation, and alternate which variant goes first. The test browser used hardware rendering on a Radeon 780M, headless Chrome at 1100 × 730 and the balanced preset. The local origin served the app, and the font provider was reached over the network.

Collect Resource Timing and the performance marks without tracing. Verify that each overview URL transfers once, the usual fonts load, the full world is available and the final scene-detail stage is reached. Then issue the battle command and time the first controllable frame. Record external CPU and external 3D engine load at approximately 500 ms intervals, excluding the test browser process tree. Keep trace and screenshot runs separate from the paired timings.

## Paired results

Medians in milliseconds, measured from navigation start except for the four intervals and the battle command latency. The limited profile used CDP with 12 Mbit/s download, 4 Mbit/s upload and 35 ms configured latency.

| Metric | Local control | Local candidate | Limited control | Limited candidate |
| --- | ---: | ---: | ---: | ---: |
| Navigation to first overview request | 18 | 18 | 53 | 54 |
| First request to overview assets ready | 1,142 | 285 | 1,051 | 1,006 |
| Assets ready to canvas created | 169 | 165 | 174 | 167 |
| Canvas created to first draw | 207 | 234 | 205 | 196 |
| First overview draw | 1,534 | 693 | 1,478 | 1,437 |
| Full world data loaded | 1,978 | 1,596 | 5,831 | 5,693 |
| Final scene-detail stage | 17,763 | 17,033 | 18,188 | 17,807 |
| Battle command to controllable frame | 361 | 359 | 344 | 337 |

The candidate reached the first draw earlier in all six local pairs (724–900 ms saved) and all three limited pairs (19–69 ms saved). On the limited profile, the entry JS download already overlapped most of the external stylesheet wait in the control. These are cold desktop browser results and the Google Fonts response time can vary by network. The filmstrip runs are excluded from the table. No measured pair was discarded. Each variant transferred each of the four overview resources once and loaded all three font families. Median columns are calculated independently. The raw CSV includes startup-window CPU and 3D samples for both variants. [Per-run data](overview-first-frame.csv)
