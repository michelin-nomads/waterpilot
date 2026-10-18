#!/usr/bin/env bash
# Select the repository-pinned Node.js toolchain (version from .nvmrc) without a version
# manager and without changing anything system-wide.
#
# It downloads the official Node.js distribution for this OS/arch into a local cache
# (default: $HOME/.cache/waterpilot-node), verifies its SHA-256 against the official
# SHASUMS256.txt, extracts it, and prints the directory to put on PATH. The Node pin ships
# the exact npm the repo expects (24.21.0 -> npm 11.19.0), so no separate npm install is
# needed. `engine-strict=true` (root .npmrc) then enforces the engines range on every
# install.
#
# Usage:
#   eval "$(scripts/use-pinned-node.sh)"      # add the pinned node/npm to PATH in this shell
#   scripts/use-pinned-node.sh --print-bin    # just print the bin directory
#   node --version && npm --version           # -> v24.21.0 / 11.19.0
#
# Reproducible: the version comes only from .nvmrc, the download is checksum-verified, and
# the cache is reused on later runs (re-extract only if missing). Nothing is committed; the
# cache lives outside the repo.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="v$(tr -d ' \t\r\n' < "$repo_root/.nvmrc")"
cache="${WATERPILOT_NODE_CACHE:-$HOME/.cache/waterpilot-node}"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux)  os=linux ;;
  *) echo "unsupported OS $(uname -s); on Windows use nvm-windows or the official MSI for $version" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch=arm64 ;;
  x86_64|amd64)  arch=x64 ;;
  *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
esac

name="node-$version-$os-$arch"
dest="$cache/$name"
bin="$dest/bin"

if [ ! -x "$bin/node" ]; then
  mkdir -p "$cache"
  tmp="$(mktemp -d "$cache/.dl.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  pkg="$name.tar.xz"
  base="https://nodejs.org/dist/$version"
  echo "fetching $pkg ..." >&2
  curl -fsSL -o "$tmp/$pkg" "$base/$pkg"
  curl -fsSL -o "$tmp/SHASUMS256.txt" "$base/SHASUMS256.txt"
  echo "verifying checksum ..." >&2
  ( cd "$tmp" && grep " $pkg\$" SHASUMS256.txt | shasum -a 256 -c - >/dev/null )
  echo "extracting ..." >&2
  tar -xf "$tmp/$pkg" -C "$cache"
fi

# Confirm the pin resolved to the exact node/npm the repo expects.
PATH="$bin:$PATH"
got_node="$("$bin/node" --version)"
got_npm="$("$bin/npm" --version)"
if [ "$got_node" != "$version" ]; then
  echo "expected node $version but got $got_node" >&2; exit 1
fi
echo "pinned node $got_node / npm $got_npm at $bin" >&2

if [ "${1:-}" = "--print-bin" ]; then
  echo "$bin"
else
  echo "export PATH=\"$bin:\$PATH\""
fi
