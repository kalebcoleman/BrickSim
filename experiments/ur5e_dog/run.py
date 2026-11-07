"""Run one simulated dog assembly; never connects to hardware."""

from os import _exit
from sys import stderr, stdout
from traceback import print_exc

from experiments.ur5e_dog.controller import main as assemble


async def main() -> None:
    """Run one dog attempt and exit the process: status 0 on success, 1 on failure.

    Kit otherwise stays alive after the run (scene reset on timeline stop).
    """
    try:
        await assemble(autoplay=True)
    except BaseException:
        print_exc()
        stderr.flush()
        _exit(1)
    stdout.flush()
    stderr.flush()
    _exit(0)
