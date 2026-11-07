"""Store-bought-brick structure library, validated with the dog recipe checker."""

import json
from pathlib import Path

from experiments.ur5e_dog.validate import validate

A = [2, 4, 3]  # 2x4 brick, long side along y (x studs, y studs, plate heights)
B = [4, 2, 3]  # 2x4 brick rotated 90 degrees, long side along x

# name: (dimensions, support index or None, offset in studs relative to support
# origin, or to the plate corner when unsupported). Order is build order.
SPECS = {
    "tower": [
        (A, None, (9, 8)),
        (B, 0, (-1, 1)),
        (A, 1, (1, -1)),
        (B, 2, (-1, 1)),
        (A, 3, (1, -1)),
        (B, 4, (-1, 1)),
    ],
    "l_corner": [
        (A, None, (6, 6)),
        (A, None, (6, 12)),
        (A, 0, (0, 2)),
        (B, 1, (0, 2)),
    ],
    "stairs": [
        (A, None, (9, 2)),
        (A, None, (9, 8)),
        (A, None, (9, 14)),
        (A, 0, (0, 2)),
        (A, 1, (0, 2)),
        (A, 2, (0, 2)),
        (A, 3, (0, 2)),
        (A, 4, (0, 2)),
    ],
}


def main() -> None:
    """Validate every spec with a clearance-safe pickup grid and print brick counts.

    Pickup positions are a placeholder grid (x -0.52/-0.43 m, y from -0.55 m in
    0.085 m steps) that satisfies the dog validator's spacing and plate clearance.
    """
    for name, parts in SPECS.items():
        config = {
            "baseplate_xy_m": [-0.25, -0.33],
            "part_names": [f"{name}_{i}" for i in range(len(parts))],
            "brick_dimensions": [p[0] for p in parts],
            "brick_colors": [[200, 30, 30]] * len(parts),
            "brick_positions_xy_m": [
                [-0.52 + 0.09 * (i // 4), -0.55 + 0.085 * (i % 4)]
                for i in range(len(parts))
            ],
            "support_bricks": [p[1] for p in parts],
            "placement_offsets": [list(p[2]) for p in parts],
        }
        origins = validate(config)
        for i, (x, y, z) in enumerate(origins):
            for j in range(i):
                px, py, pz = origins[j]
                dx, dy = config["brick_dimensions"][j][:2]
                if (
                    z == pz
                    and max(
                        x - px - dx,
                        px - x - parts[i][0][0],
                        y - py - dy,
                        py - y - parts[i][0][1],
                    )
                    < 2
                ):
                    raise ValueError(f"{name}: same-layer gap under 2 studs: {j}, {i}")
        Path(__file__).with_name(f"{name}.json").write_text(
            json.dumps(config, indent=2) + "\n"
        )
        print(f"{name}: {len(parts)} bricks valid")


if __name__ == "__main__":
    main()
