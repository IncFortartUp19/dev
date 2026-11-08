"""Check tracked text files without third-party dependencies."""

import subprocess
import sys
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root, check=True, capture_output=True,
    )
    errors = []
    for name in sorted(set(result.stdout.split(b"\0")) - {b""}):
        path = root / name.decode("utf-8")
        if path.is_symlink() or not path.is_file():
            continue
        data = path.read_bytes()
        if not data or b"\0" in data:
            continue
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        relative = path.relative_to(root)
        if "\r" in content:
            errors.append(f"{relative}: use LF line endings")
        if not content.endswith("\n"):
            errors.append(f"{relative}: missing final newline")
        for number, line in enumerate(content.splitlines(), 1):
            if line.rstrip(" \t") != line:
                errors.append(f"{relative}:{number}: trailing whitespace")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Repository checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
