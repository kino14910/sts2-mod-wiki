#!/usr/bin/env python3
"""Compatibility entry point for regenerating the vanilla dataset.

The old implementation read a flat ILSpy folder at
`D:/sts-fgoMod/Slay the Spire 2 decompile/MegaCrit.Sts2.Core.Models.Cards`,
which no longer exists for current builds. It also only rebuilt cards.json,
so new cards had no localization and were dropped by the runtime loader.

This now delegates to generate_vanilla.py, which reads the current
`<game>/src/Core/Models/...` layout and rebuilds cards, collections, powers,
localization and the manifest together. `CARDS_OUT` still overrides the
cards.json destination; all other generator flags are forwarded.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_vanilla import main  # noqa: E402


if __name__ == "__main__":
    argv = sys.argv[1:]
    if os.environ.get("CARDS_OUT"):
        argv += ["--cards-out", os.environ["CARDS_OUT"]]
    if os.environ.get("STS2_GAME") and not any(a.startswith("--game") for a in argv):
        argv += ["--game", os.environ["STS2_GAME"]]
    sys.exit(main(argv))
