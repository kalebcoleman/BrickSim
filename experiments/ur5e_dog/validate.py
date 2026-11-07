"""Check stud-grid geometry without Isaac Sim. This is not a dynamics test."""

import json
from pathlib import Path


def validate(config: dict) -> list[tuple[int, int, int]]:
    """Validate ordered, yaw-zero brick boxes and return grid origins.

    Args:
        config: Dog JSON configuration. XY uses stud units (8 mm), Z uses plate
            units (3.2 mm); all parts must have height three plate units.

    Returns:
        Integer XYZ origins relative to the 20-by-20 anchored baseplate top.

    Raises:
        ValueError: Invalid lengths, unsupported parts, overlap, plate overflow
            or a source brick within 30 mm of the baseplate.
    """
    count = len(config["brick_dimensions"])
    for key in (
        "part_names",
        "brick_colors",
        "brick_positions_xy_m",
        "support_bricks",
        "placement_offsets",
    ):
        if len(config[key]) != count:
            raise ValueError(f"Length mismatch: {key}")
    origins = []
    for i, (size, parent, offset) in enumerate(
        zip(
            config["brick_dimensions"],
            config["support_bricks"],
            config["placement_offsets"],
            strict=True,
        )
    ):
        if len(size) != 3 or any(type(v) is not int or v <= 0 for v in size):
            raise ValueError(f"Invalid dimensions: {i}")
        if size[2] != 3 or len(offset) != 2 or any(type(v) is not int for v in offset):
            raise ValueError(f"Unsupported height or offset: {i}")
        if parent is not None and (type(parent) is not int or not 0 <= parent < i):
            raise ValueError(f"Invalid support order: {i}")
        parent_size = (
            [20, 20, 0] if parent is None else config["brick_dimensions"][parent]
        )
        origin = (0, 0, 0) if parent is None else origins[parent]
        x, y, z = (
            origin[0] + offset[0],
            origin[1] + offset[1],
            origin[2] + parent_size[2],
        )
        overlap = [
            max(0, min(parent_size[a], offset[a] + size[a]) - max(0, offset[a]))
            for a in (0, 1)
        ]
        if overlap[0] * overlap[1] < 4:
            raise ValueError(f"Fewer than four supporting studs: {i}")
        if x < 0 or y < 0 or x + size[0] > 20 or y + size[1] > 20:
            raise ValueError(f"Outside baseplate footprint: {i}")
        for j, previous in enumerate(origins):
            other = config["brick_dimensions"][j]
            if all(
                max(a, b) < min(a + c, b + d)
                for a, b, c, d in zip((x, y, z), previous, size, other, strict=True)
            ):
                raise ValueError(f"Solid collision between {j} and {i}")
        origins.append((x, y, z))
    for i, position in enumerate(config["brick_positions_xy_m"]):
        for j in range(i):
            previous = config["brick_positions_xy_m"][j]
            if all(
                abs(position[a] - previous[a])
                < 0.004
                * (config["brick_dimensions"][i][a] + config["brick_dimensions"][j][a])
                + 0.02
                for a in (0, 1)
            ):
                raise ValueError(f"Insufficient source spacing: {j}, {i}")
    plate = config["baseplate_xy_m"]
    for i, (position, size) in enumerate(
        zip(config["brick_positions_xy_m"], config["brick_dimensions"], strict=True)
    ):
        # A closing finger needs 30 mm of free table beside the plate's footprint.
        if all(
            abs(position[a] - plate[a]) < 0.08 + 0.004 * size[a] + 0.03 for a in (0, 1)
        ):
            raise ValueError(f"Source too close to baseplate: {i}")
    return origins


if __name__ == "__main__":
    data = json.loads(Path(__file__).with_name("dog.json").read_text())
    print(
        json.dumps(
            {"geometry_valid": True, "origins_stud_plate_units": validate(data)},
            indent=2,
        )
    )
