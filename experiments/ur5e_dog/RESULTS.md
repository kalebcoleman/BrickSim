# Dog assembly results

Simulation only. Each run is a fresh virtual scene; nothing is reset or edited mid-run.

| Run | Pickup layout | Connections | Outcome |
|---|---|---|---|
| 1 | `dog.json`, head at (-0.34,-0.38) | 8/10 | head not retained (finger closed on baseplate edge) |
| 2 | same | 8/10 | identical failure |
| 3 | `dog.json`, head at (-0.43,-0.295) | 10/10 | success; continuous video recorded |
| 4–8 | `variants/seed_1..5.json` | 10/10 each | 5/5 success |

Variants jitter every pickup XY by up to ±15 mm (seeded, validator-checked; yaw 0).
Across the five: max grasp-center error 0.8 mm, max pre-press XY correction 1.6 mm
(mean 1.3 mm), 0 timeouts. No recovery logic exists, so "0 recovery attempts" means
none were implemented, not that none were needed.

## What is and is not sensed

Pickup poses, held-brick pose and the pre-press XY correction come from simulator
ground truth, as do snap/weld connections (breakage disabled). Pickup positions are
known to the controller exactly. This is not perception and not stud insertion.
The jitter set is small and in-distribution; it says nothing yet about piles,
unknown positions, yaw or contact uncertainty.
