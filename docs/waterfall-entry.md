# Canyon waterfall reveal during battle entry

The control is main at `9db8bd0`. In the candidate, hardware WebGL with parallel shader compilation prepares the actual waterfall group against the live scene during battle entry. The group stays hidden from foliage detail level 7 through level 8 and appears at level 9. On the streamed route those boundaries are map stages 12 and 14. Water and mist animation starts at reveal. Software rendering, overview mode and renderers without the extension retain the visible mount at level 9.

## Cold route comparison

Chrome used hardware ANGLE D3D11 on a Radeon 780M at 1100 × 730, balanced settings and a fixed resolution scale of 0.85. Network emulation used 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Each run used a fresh profile and clicked battle from the first map overview. The mech drove one world unit. The firing route also fired once at stage 10. Each route ran twice per build in opposite build order. The four baked world assets matched by SHA-256.

Frame duration is the interval between consecutive main-scene render completions. The primary metric is the longest such interval from stage 12 through the eighth observed frame on stage 16. The reveal is identified by the curtain material's first draw call. All eight runs revealed the waterfall on stage 14 and recorded their largest post-control frame there.

| Maximum frame, ms | Main | Candidate |
| --- | ---: | ---: |
| Drive, pair 1 | 1,519 | 904 |
| Drive, pair 2 | 1,424 | 861 |
| Drive and fire, pair 1 | 1,530 | 857 |
| Drive and fire, pair 2 | 1,391 | 869 |
| Median | 1,472 | 865 |

The reveal added 11 renderer programs on main and six on the candidate in every pair. In a separate diagnostic pair the waterfall draw calls taking at least 3 ms summed to 476 ms on main and 16 ms on the candidate. These are CPU-side submission times including driver waits. The two flank-cover draws still accounted for 300 ms in the candidate trace. Background 3D utilization during the measured stages peaked at 19.7% in one control run. [Per-run measurements](waterfall-entry.csv)

The candidate started preparation 3.24–4.04 s after the first controllable frame and 2.42–2.50 s ahead of first waterfall draw. In the four route pairs the median click-to-control time was 4.751 s on main and 5.202 s with preparation. The control mark coincided with streaming stage 5 in one main run and three candidate runs.

Four additional cold pairs measured entry using browser marks alone. Both builds waited for low external CPU and 3D activity before launching. Click-to-control times on main / candidate in ms were 5,100 / 4,652, 4,580 / 5,123, 4,671 / 5,134 and 4,676 / 5,588. The median increased from 4.673 s to 5.128 s. All main runs reached control on stage 4 and two candidate runs reached it on stage 5. In the two stage-matched pairs the difference went in opposite directions. Median click-to-world-request increased from 116 to 294 ms, request-to-world-loaded from 4,041 to 4,277 ms and world-loaded-to-control from 527 to 553 ms. Background load varied during the runs. Investigate the entry difference before promoting this branch.

The baseline, candidate and candidate with the parallel compilation extension disabled all showed the falls on stage 14. Their post-reveal snapshots matched on position buffers, indices, rock instance matrices, material program keys, colors, sidedness and shadow flags across the rocks, curtain, splash and eight mist sprites. The fallback did not invoke early waterfall compilation.
