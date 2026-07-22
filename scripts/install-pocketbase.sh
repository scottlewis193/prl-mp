#!/usr/bin/env sh
set -eu

version="${POCKETBASE_VERSION:-0.39.9}"
os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

case "$arch" in
	x86_64 | amd64) arch="amd64" ;;
	aarch64 | arm64) arch="arm64" ;;
	*) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac

case "$os" in
	linux | darwin) ;;
	*) echo "Unsupported operating system: $os" >&2; exit 1 ;;
esac

project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
install_dir="$project_dir/pocketbase"
binary="$install_dir/pocketbase"

if [ -x "$binary" ] && "$binary" --version | grep -q "version $version$"; then
	echo "PocketBase $version is already installed."
	exit 0
fi

archive="pocketbase_${version}_${os}_${arch}.zip"
base_url="https://github.com/pocketbase/pocketbase/releases/download/v${version}"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

curl -fL "$base_url/$archive" -o "$temp_dir/$archive"
curl -fL "$base_url/checksums.txt" -o "$temp_dir/checksums.txt"

expected="$(grep " $archive$" "$temp_dir/checksums.txt" | cut -d ' ' -f 1)"
if command -v sha256sum >/dev/null 2>&1; then
	actual="$(sha256sum "$temp_dir/$archive" | cut -d ' ' -f 1)"
else
	actual="$(shasum -a 256 "$temp_dir/$archive" | cut -d ' ' -f 1)"
fi
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
	echo "PocketBase checksum verification failed." >&2
	exit 1
fi

mkdir -p "$install_dir"
unzip -jo "$temp_dir/$archive" pocketbase -d "$install_dir"
chmod +x "$binary"
"$binary" --version
