# Impact decals on the first controllable frame

In a cold Chrome trace of main at `59cba42`, the crater mesh submitted zero instances. Three.js spent 369 ms in that mesh's draw call, including driver waits. The controllable-frame mark fired inside the scene's after-render callback. This locates the stall on the frame that enables control.

The crater mesh now starts with a count of zero. On renderers with parallel shader compilation, it prepares its program after the decal attribute is attached and stays hidden until an impact populates it. The same visibility check runs when decals expire or the mission restarts. With the extension disabled, Three.js follows the usual visible-mesh path. Chrome checks confirmed a bullet mark appeared, cleared on restart and appeared again in both modes.

## Paired results

Eight pairs compared local production builds on Radeon 780M, using fresh hardware Chrome profiles and the balanced [terrain replay](terrain-road-reveal.md). Each timing condition ran twice with reversed build order at both automatic and fixed resolution. The harness queued a dry-surface bullet hit through the combat event consumer immediately after the first empty crater frame or after 1.8 seconds of control. This measures the first decal independently of projectile flight. Frame intervals include all scene work between the ends of successive main-scene submissions.

| Median | Main | Candidate |
| --- | ---: | ---: |
| First controllable frame interval, empty crater pool | 929 ms | 518 ms |
| Time inside the renderer on that frame | 823 ms | 414 ms |
| Battle click to first controllable frame | 5.282 s | 4.827 s |
| First visible decal frame, immediate impact (4 pairs) | 428 ms | 437 ms |
| First visible decal frame, later impact (4 pairs) | 54 ms | 76 ms |

The empty-pool frame improved in all eight pairs. Four pairs met the river replay's background-load limits across the interval from the start of the empty frame to the first visible decal. Median empty-frame times for those pairs were approximately 896 ms and 514 ms. Other runs included concurrent CPU and 3D activity.

In a separate candidate trace the first nonempty crater submission took 1.9 ms. The complete immediate-impact frame took 452 ms and included 173 ms for a zero-instance shell-casing submission and 81 ms for distant infantry. A shorter empty-pool frame therefore improves entry, while the first impact frame still includes substantial work in other draws.
