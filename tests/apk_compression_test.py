# SPDX-License-Identifier: GPL-3.0-or-later
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("compact", Path(__file__).parents[1] / "scripts/compact-android.py")
compact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compact)


class CompressionTest(unittest.TestCase):
    def test_every_entry_and_storage_method_survives(self):
        with tempfile.TemporaryDirectory() as temp:
            original, result = Path(temp) / "original.apk", Path(temp) / "result.apk"
            with zipfile.ZipFile(original, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as apk:
                apk.writestr("lib/arm64-v8a/libgojni.so", b"native fixture" * 10000)
                apk.writestr("classes.dex", b"dex fixture" * 1000)
                stored = zipfile.ZipInfo("resources.arsc")
                stored.compress_type = zipfile.ZIP_STORED
                stored.external_attr = 0o100644 << 16
                apk.writestr(stored, bytes(range(256)) * 10)
                for info in apk.filelist:
                    info.external_attr = 0  # Android packaging commonly omits Unix modes.
            compact.recompress(original, result)
            self.assertEqual(compact.entries(original), compact.entries(result))
            self.assertLess(result.stat().st_size, original.stat().st_size)

    def test_signed_input_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            original = Path(temp) / "signed.apk"
            with zipfile.ZipFile(original, "w") as apk:
                apk.writestr("META-INF/CERT.RSA", b"signature")
            with self.assertRaisesRegex(ValueError, "unsigned"):
                compact.recompress(original, Path(temp) / "result.apk")


if __name__ == "__main__":
    unittest.main()
