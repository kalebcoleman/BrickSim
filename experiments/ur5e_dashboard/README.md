# Experiment results viewer

Open recorded UR5e brick experiments in a local, read-only browser dashboard.
From the repository root, run:

    python3 experiments/ur5e_dashboard/server.py

Open `http://127.0.0.1:8765` and select a run. The committed example recordings
and videos appear immediately. The server uses only the Python standard library;
Isaac Sim does not need to be running. Stop the server with Ctrl+C.

To inspect recordings in another checkout, or choose a different local port:

    python3 experiments/ur5e_dashboard/server.py --experiment-root /path/to/checkout --port 8766

The selected root may contain live or archived JSON Lines files under
`outputs/ur5e_lego/` and the committed compressed examples under
`experiments/ur5e_lego/docs/evidence/`. Matching plain and compressed logs are
listed once. A new video can be placed beside its log with the same base name,
for example `example.jsonl` and `example.mp4`. Press **Refresh runs** after new
data is written. An unfinished recording is marked incomplete; the viewer does
not control or modify the simulator or files.

The run list, phase history, connection state, last pre-connection alignment,
settings, and signal plots come from the recorded samples. The plots use a
reduced set of samples for display; phase and connection events are computed
from every recorded sample. Download the source log for full-resolution data.
The recorded elapsed time labels the end of the physics step; samples precede
that step, so subtract `physics_dt_s` for the sample time.
Video playback is independent of log time. Some curated videos show a different
trial of the same experiment, as identified beside the video.

All current logs are simulation data. Tool and part poses are in the world
frame, placement errors are in the support frame, joint angles are radians,
positions are meters, and force is in newtons. The viewer converts placement
errors and tolerances to millimeters. The Z value is the gap from the seated
pose, not a physical force or a hardware accuracy measurement. USD poses may
update at the render rate; contact debug data is available only when recorded.
Non-finite numeric values are shown as unavailable.
The recorded video and data do not establish physical robot performance.

Run the focused checks from the repository root:

    python3 -m unittest discover -s experiments/ur5e_dashboard -p 'test_*.py'
