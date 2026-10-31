# UR5e brick transfer

This separate simulation places three 2×4 bricks on the Vention workstation.
The lab UR5e stays fixed on the workstation rail and uses the RG2 gripper to
attempt one pick, transfer, and release. The source robot, gripper, rail, and
workstation are referenced from the `isaac-mcp` checkpoint; their files are not
modified. The lab checkpoint's ROS graphs are disabled in this scene.

The experiment requires an Isaac Sim 5.1 environment and the lab checkpoint
named in `research/configs/ur5e_lego.json`. That path is specific to this
machine: on another machine, update `checkpoint` to the absolute path of the
local checkpoint. The checkpoint refers to robot, gripper, and workstation
assets relative to its location in the `isaac-mcp/checkpoints/` directory.
Those source assets are tracked in the MCP repository, but the checkpoint
USDA is ignored by Git. Copy the tested checkpoint to that directory, or follow
the regeneration guidance in `isaac-mcp/checkpoints/ur5e-dt-workstation-person-view-portable.json`.
The tested local checkpoint's SHA-256 begins `b2b99903`; the manifest records
`54a30cea`. Preserve the tested file for exact reproduction rather than
assuming it matches the manifest.

The workstation is a visual model. Its black tabletop is lower than the
checkpoint's invisible ground plane, so the experiment disables that plane and
adds a collision box aligned with the tabletop mesh. Table and brick positions
are in meters; joint angles are in radians and quaternions use wxyz order. The
rail remains stationary. The default camera is framed around the bricks and
gripper, with a dome light providing additional fill.

From the repository root, start a separate simulator instance with:

    ./scripts/run_ur5e_lego.sh

The script opens the Stage, Property, and Console panels and selects the arm.
It pauses after loading. Press Play to attempt the transfer. It reports each
phase in the terminal, checks whether the brick rose with the gripper, and
checks its final position after release. Press Stop to restore the starting
scene, whether the transfer has finished or is still moving. Wait for the
`press Play to begin` message, then press Play to run the full transfer again.
The configuration is in
`research/configs/ur5e_lego.json`; it contains the local checkpoint path and
brick positions.

The first live attempts failed because the RG2 fingertips move downward as the
gripper closes and hit the table. The script now measures the closed fingertip
geometry in free air before approaching the brick. On 2026-10-30, one simulated
trial picked, lifted, transferred, and released the red brick; it settled at
(-0.24923, -0.35067, -0.08547) m, about 1 mm from the requested XY location.
The brick was dynamic and non-kinematic. This is one trial, not a robustness or
physical calibration result. Evidence is in
`outputs/rise/ur5e-lego-inspection/agent-run.log` and `success.png`.
The full-window recording is
`outputs/rise/ur5e-lego-video/ur5e-brick-transfer.mp4`.
The recording and logs are local outputs ignored by Git.

## Changes and ownership

The experiment, its configuration, and the launcher are
`experiments/rise_ur5e_lego.py`, `research/configs/ur5e_lego.json`, and
`scripts/run_ur5e_lego.sh`. The script composes the checkpoint in a new scene,
adds the tabletop collider and bricks, measures gripper clearance, and runs
the arm and gripper through the transfer. Its Stop handler reloads that scene.
`python/bricksim/utils/physics_step.py` checks whether Isaac Sim already
removed a physics callback before cleaning it up after an interruption.

The separate `isaac-mcp` repository received documentation changes in
`README.md` and `docs/MCP-SERVER.md`. They explain how agents can inspect
windows, distinguish host tools from the in-simulator bridge, select and verify
the simulator process, and use the bridge client when tool discovery is stale.
No MCP source code or lab asset was changed for this experiment.

To control a separate experiment process through the generic MCP bridge, set
`ISAAC_MCP_PORT` to an unused port and pass the extension options to the
launcher, for example:

    ISAAC_MCP_PORT=8766 ./scripts/run_ur5e_lego.sh \
      --ext-path /home/kaleb/Desktop/isaac-mcp/exts/isaac.mcp.bridge \
      --enable isaac.mcp.bridge

Verify the process and port with the bridge's `status` before acting. Do not use
this experiment to control physical hardware.
