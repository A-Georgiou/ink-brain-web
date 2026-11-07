#!/usr/bin/env bash
# Installs or updates Ink Brain on a Mac: curl -fsSL https://inkbrain.app/install.sh | bash
# The installer lives with the app's code, so this runs the latest one: https://github.com/A-Georgiou/ink-brain/blob/main/install.sh
set -euo pipefail

script=$(curl -fsSL https://raw.githubusercontent.com/A-Georgiou/ink-brain/main/install.sh)
[[ $script == "#!"* ]] || { echo "Could not download the Ink Brain installer from GitHub: the network sent something else." >&2; exit 1; }
exec bash -c "$script" install.sh "$@"
