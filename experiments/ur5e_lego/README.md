# UR5e brick experiments

This folder contains the RISE lab UR5e brick work: the scripts, workstation
scene, settings, launchers, experiment notes, and recorded evidence. The
existing project demos and other experiments remain outside this folder.

From the repository root, choose an experiment:

- [Pick up and transfer one brick](docs/ur5e-lego.md):
  `./experiments/ur5e_lego/scripts/run_ur5e_lego.sh`
- [Place three bricks on the baseplate](docs/ur5e-baseplate.md):
  `./experiments/ur5e_lego/scripts/run_ur5e_baseplate.sh`
- [Stack three bricks](docs/ur5e-stack.md):
  `./experiments/ur5e_lego/scripts/run_ur5e_stack.sh`

The guides describe the Isaac Sim 5.1 and lab asset requirements, controls,
results, and limitations. `configs/` contains the scene and placement settings,
`assets/` contains the workstation layout, and `docs/evidence/` contains the
versioned results. Earlier local recordings remain under the ignored
`outputs/rise/` directory.

All three scenes load Isaac Sim's Simple Room through the configured Isaac asset
root. The room is a visual backdrop: its table is removed and its colliders and
rigid bodies are disabled. The existing tabletop collider supports the bricks.
The room asset must be accessible from the configured asset root; the scripts
fail if it cannot be loaded. [Stage inspection](docs/evidence/ur5e-room-stage.json).

One related change is outside this folder: the shared
[`physics_step.py`](../../python/bricksim/utils/physics_step.py) utility checks
whether a physics callback still exists before removing it after an
interruption. Other project code uses this utility too. The separate untracked
two-arm research is not part of these brick experiments.
