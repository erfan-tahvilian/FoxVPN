# SPDX-License-Identifier: GPL-3.0-or-later
import importlib.util
import io
from pathlib import Path
import tarfile
import unittest

spec = importlib.util.spec_from_file_location("source", Path(__file__).parents[1] / ".github/scripts/verify-source.py")
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


class SourceTest(unittest.TestCase):
    def archive(self, prefix, mode=0o644, value=b"source"):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode="w") as archive:
            info = tarfile.TarInfo(prefix + "/build.sh")
            info.size, info.mode = len(value), mode
            archive.addfile(info, io.BytesIO(value))
        return data.getvalue()

    def test_wrapper_names_do_not_hide_content_or_permission_changes(self):
        expected = source.inventory(self.archive("FoxVPN"))
        self.assertEqual(expected, source.inventory(self.archive("FoxVPN-commit")))
        self.assertNotEqual(expected, source.inventory(self.archive("FoxVPN", mode=0o755)))
        self.assertNotEqual(expected, source.inventory(self.archive("FoxVPN", value=b"different")))


if __name__ == "__main__":
    unittest.main()
