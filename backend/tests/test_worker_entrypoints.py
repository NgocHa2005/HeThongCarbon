import subprocess
import sys
import unittest
from pathlib import Path


class WorkerEntrypointTests(unittest.TestCase):
    def test_each_worker_has_a_checkable_entrypoint_and_refuses_unimplemented_run(self):
        backend_dir = Path(__file__).resolve().parents[1]
        modules = (
            "workers.analysis",
            "workers.clustering",
            "workers.prediction",
        )

        for module in modules:
            with self.subTest(module=module):
                check = subprocess.run(
                    [sys.executable, "-m", module, "--check"],
                    cwd=backend_dir,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    check=False,
                )
                self.assertEqual(check.returncode, 0, check.stderr)
                self.assertIn("entry point OK", check.stdout)

                run = subprocess.run(
                    [sys.executable, "-m", module],
                    cwd=backend_dir,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    check=False,
                )
                self.assertEqual(run.returncode, 2)
                self.assertIn("thuật toán chưa được triển khai", run.stderr)


if __name__ == "__main__":
    unittest.main()
