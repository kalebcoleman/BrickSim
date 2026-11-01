"""Test recorded run summaries and the read-only HTTP interface."""

from gzip import open as open_gzip
from http.client import HTTPConnection
from json import dumps, loads
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from unittest import TestCase, main

from server import DashboardServer, RunCollection


class ResultsViewerTests(TestCase):
    """Exercise completed, interrupted, and incomplete recordings."""

    def setUp(self) -> None:
        """Create a small recording and its matching compressed evidence."""
        temporary_root = Path.cwd() / "outputs" / "ur5e-dashboard-tests"
        temporary_root.mkdir(parents=True, exist_ok=True)
        self.temporary = TemporaryDirectory(dir=temporary_root)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.outputs = self.root / "outputs/ur5e_lego"
        self.evidence = self.root / "experiments/ur5e_lego/docs/evidence"
        self.outputs.mkdir(parents=True)
        self.evidence.mkdir(parents=True)
        metadata = {
            "kind": "metadata",
            "experiment": "stack_four",
            "created_utc": "2026-10-31T23:46:58+00:00",
            "source": "simulation",
            "gripper_joint_names": ["other", "rg2_gripper_joint"],
        }
        placement: dict[str, object] = {
            "stud_path": "/part0",
            "hole_path": "/part1",
            "position_error_m": [0.0003, 0.0004, 0.0017],
            "connected": False,
            "connected_offset_studs": None,
            "connected_yaw": None,
        }
        sample = {
            "kind": "sample",
            "simulation_elapsed_s": 1.0,
            "phase": "press",
            "brick_index": 1,
            "placements": [placement],
            "robot": {
                "position_rad": [0.1],
                "command_position_rad": [0.2],
                "velocity_rad_s": [0.3],
                "effort_nm": [0.4],
            },
            "gripper": {"position_rad": [1.0, 0.5], "command_position_rad": 0.6},
            "tool_pose_world": {"position_m": [0.1, 0.2, 0.3]},
            "tool_target_world": {"position_m": [0.4, 0.5, 0.6]},
            "assembly_settings": {"required_force_n": 1.0},
            "breakage_settings": {"enabled": False},
            "simulation_contacts": [{"projected_force_n": -2.0}],
        }
        connected = dict(placement)
        connected.update(connected=True, connected_offset_studs=[3, 8], connected_yaw=0)
        final_sample = dict(sample)
        final_sample.update(simulation_elapsed_s=2.0, placements=[connected])
        self.records = [
            metadata,
            sample,
            final_sample,
            {"kind": "end", "status": "completed"},
        ]
        self.content = "".join(dumps(record) + "\n" for record in self.records)
        self.raw = self.outputs / "sample-stack-four.jsonl"
        self.raw.write_text(self.content)
        with open_gzip(self.evidence / "ur5e-stack-four-run.jsonl.gz", "wt") as stream:
            stream.write(self.content)
        (self.evidence / "ur5e-stack-four-room.mp4").write_bytes(b"0123456789")
        (self.evidence / "ur5e-stack-four-result.png").write_bytes(b"image")
        self.collection = RunCollection(self.root)

    def test_completed_run_contains_recorded_values(self) -> None:
        """A complete run retains its event and simulated motion values."""
        runs = self.collection.refresh()
        self.assertEqual(len(runs), 1)
        run = runs[0]
        self.assertEqual(run["filename"], self.raw.name)
        self.assertEqual(
            (run["status"], run["samples"], run["duration_s"]), ("completed", 2, 2.0)
        )
        self.assertTrue(run["placements"][0]["connected"])
        self.assertEqual(run["events"][0]["error_m"], [0.0003, 0.0004, 0.0017])
        self.assertEqual(run["events"][0]["offset"], [3, 8])
        self.assertEqual(run["chart"][0]["gripper"], 0.5)
        self.assertEqual(run["chart"][0]["joint_commands"], [0.2])
        self.assertEqual(run["chart"][0]["tool_target"], [0.4, 0.5, 0.6])
        self.assertEqual(run["chart"][0]["force"], 2.0)
        self.assertIn("this run", run["video_label"])
        self.assertTrue(run["poster"])

    def test_incomplete_and_failed_runs_are_not_completed(self) -> None:
        """A partial final line and a failure end record stay distinct."""
        metadata = dict(self.records[0])
        metadata.update(experiment="stack", created_utc="2026-10-31T22:00:00+00:00")
        partial = self.outputs / "partial.jsonl"
        partial.write_text(
            dumps(metadata) + "\n" + dumps(self.records[1]) + '\n{"kind":'
        )
        metadata.update(created_utc="2026-10-31T22:01:00+00:00")
        failed = self.outputs / "failed.jsonl"
        failed.write_text(
            dumps(metadata)
            + "\n"
            + dumps(self.records[1])
            + "\n"
            + dumps({"kind": "end", "status": "interrupted_or_failed"})
            + "\n"
        )
        statuses = {run["filename"]: run["status"] for run in self.collection.refresh()}
        self.assertEqual(statuses[partial.name], "incomplete")
        self.assertEqual(statuses[failed.name], "interrupted_or_failed")

    def test_recordings_are_deduplicated_and_cache_refreshes(self) -> None:
        """Identical raw and compressed logs count once; changes are reread."""
        first = self.collection.refresh()
        self.assertEqual(len(first), 1)
        self.raw.write_text(self.content.replace('"completed"', '"stopped"'))
        second = self.collection.refresh()
        self.assertEqual(len(second), 1)
        self.assertEqual(second[0]["status"], "stopped")

    def test_empty_collection_has_no_invented_runs(self) -> None:
        """An empty experiment root produces an empty library."""
        self.assertEqual(RunCollection(self.root / "empty").refresh(), [])

    def test_nonfinite_values_are_unavailable(self) -> None:
        """Invalid numeric measurements do not break the browser JSON response."""
        self.raw.write_text(
            self.content.replace('"position_rad": [0.1]', '"position_rad": [NaN]')
        )
        run = self.collection.refresh()[0]
        self.assertIsNone(run["chart"][0]["joints"][0])
        dumps(run, allow_nan=False)

    def test_new_compressed_run_can_use_a_matching_video(self) -> None:
        """A new compressed output discovers its matching named video."""
        metadata = dict(self.records[0])
        metadata.update(experiment="custom", created_utc="2026-11-01T01:00:00+00:00")
        compressed = self.outputs / "custom.jsonl.gz"
        with open_gzip(compressed, "wt") as stream:
            for record in [metadata, *self.records[1:]]:
                stream.write(dumps(record) + "\n")
        (self.outputs / "custom.mp4").write_bytes(b"video")
        run = next(
            item
            for item in self.collection.refresh()
            if item["filename"] == compressed.name
        )
        self.assertTrue(run["video"])
        self.assertIn("matching filename", run["video_label"])

    def test_other_run_does_not_claim_example_video_is_exact(self) -> None:
        """An experiment's example video is clearly labeled for another run."""
        other_metadata = dict(self.records[0])
        other_metadata["created_utc"] = "2026-11-01T01:00:00+00:00"
        other = self.outputs / "another.jsonl"
        other.write_text(
            "".join(
                dumps(record) + "\n" for record in [other_metadata, *self.records[1:]]
            )
        )
        run = next(
            item for item in self.collection.refresh() if item["filename"] == other.name
        )
        self.assertIn("different run", run["video_label"])

    def test_http_run_video_range_and_path_restriction(self) -> None:
        """The local API returns the run and only serves allowlisted files."""
        server = DashboardServer(0, self.collection)
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        try:
            connection.request("GET", "/api/runs")
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            run_id = loads(response.read())[0]["id"]
            connection.request("GET", f"/api/run?id={run_id}")
            response = connection.getresponse()
            self.assertEqual(loads(response.read())["samples"], 2)
            connection.request("GET", f"/download?id={run_id}")
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), self.raw.read_bytes())
            connection.request("GET", f"/poster?id={run_id}")
            response = connection.getresponse()
            self.assertEqual(response.read(), b"image")
            connection.request(
                "GET", f"/video?id={run_id}", headers={"Range": "bytes=2-5"}
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 206)
            self.assertEqual(response.getheader("Content-Range"), "bytes 2-5/10")
            self.assertEqual(response.read(), b"2345")
            connection.request(
                "GET", f"/video?id={run_id}", headers={"Range": "bytes=20-30"}
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 416)
            response.read()
            connection.request("GET", "/video?id=../../etc/passwd")
            response = connection.getresponse()
            self.assertEqual(response.status, 404)
            response.read()
        finally:
            connection.close()
            server.shutdown()
            worker.join(timeout=5)
            server.server_close()


if __name__ == "__main__":
    main()
