# UR5e baseplate assembly

This simulation uses the lab UR5e and RG2 gripper on the fixed Vention rail to
pick up three 2×4 bricks and connect them to a 20×20 light-gray baseplate on the
table. The baseplate is kinematic, so it stays fixed while the robot presses.
The original one-brick experiment remains available separately.

Use the Isaac Sim 5.1 environment and lab assets described in
[`ur5e-lego.md`](ur5e-lego.md). From the repository root, run:

    ./experiments/ur5e_lego/scripts/run_ur5e_baseplate.sh

If the MCP checkout is elsewhere, set `ISAAC_MCP_ROOT` to its path before
running. Press Play after the scene loads. Press Stop to rebuild the initial
scene; wait for `press Play to begin`, then press Play to repeat. The source
brick positions come from `experiments/ur5e_lego/configs/ur5e_lego.json`. The baseplate
position and the three stud-grid offsets are in
`experiments/ur5e_lego/configs/ur5e_baseplate.json`.

The experiment measures the closed finger collision geometry to center its
grasp and maintain fingertip clearance. The finger collision centers are
offset from the original grasp marker, so the target compensates for that
offset before checking the finger-center error after closing. The placement
pose uses the actual held brick and the desired stud connection. Each placement
uses a two-second descent and a one-second press hold after connection. The
controller requests a final position 0.5 mm below the ideal connection pose,
as in the assembly demo.
Contact forces are reported from the simulation's assembly diagnostics when
available. The script verifies the direct physics connection for every placed
brick, and checks all three again after release, retreat, and settling.

The simulation uses meters for positions, radians for joint angles, wxyz
quaternions, and stud units for placement offsets. The baseplate offsets are
`(3, 8)`, `(9, 8)`, and `(15, 8)`, with yaw index 0. The fixed setup was tested
with the asset revision recorded in the one-brick guide. It is not a physical
robot program or a physical-force calibration.

## Validation

Two complete runs succeeded with Stop and Play between them. The measured
finger-center errors were 0.1, 0.3, and 0.2 mm for the red, blue, and green
bricks. Each press was held for one simulated second after connection; the
reported peak contact forces were 1.20, 1.69, and 1.25 N. A physics-graph query
after the second run found all three direct plate connections active and no
disassembly events. These are repeat runs of one fixed scene, not a robustness
study.

The simulator also reported that its optional ROS 2 bridge could not load
`libament_index_cpp.so`. The assembly completed without that bridge; this
experiment does not use ROS 2.

- [Full-window video](evidence/ur5e-baseplate-assembly.mp4) (85.5 seconds, no audio)
- [Pressing frame](evidence/ur5e-baseplate-press.png) and [final assembly](evidence/ur5e-baseplate-result.png)
- [Physics connections](evidence/ur5e-baseplate-connections.json) and [experiment log](evidence/ur5e-baseplate-log.txt)
