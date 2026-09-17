# Project evidence excerpt: EXP012_R1 recovery regression tests
# Source: tests/test_exp012_r1_resume.py, lines 116-141.
# Only the enclosing class indentation is removed.
# This excerpt depends on the original test fixtures/imports; it is not a standalone test file.
# No test run was performed while preparing this excerpt.

def test_resume_calls_only_missing_observations(self) -> None:
    plan, _ = self.create_two_checkpoints()
    provider = FakeProvider()
    _, _, stats = self.execute(provider, resume=True)
    self.assertEqual(len(provider.calls), len(plan) - 2)
    self.assertEqual(stats["reused_checkpoints"], 2)
    self.assertEqual(stats["remaining"], 0)

def test_completed_observations_are_never_called_again(self) -> None:
    plan, _, _ = self.execute(FakeProvider())

    def forbidden_call(*args: object, **kwargs: object) -> object:
        raise AssertionError("completed observation was called again")

    _, _, stats = self.execute(forbidden_call, resume=True)  # type: ignore[arg-type]
    self.assertEqual(stats["new_calls"], 0)
    self.assertEqual(stats["reused_checkpoints"], len(plan))

def test_prompt_hash_change_stops_resume(self) -> None:
    plan, identity = self.create_two_checkpoints()
    path = r1.checkpoint_path(self.exp_root, "relevant", str(plan[0]["observation_id"]))
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["prompt_sha256"] = "0" * 64
    path.write_text(json.dumps(payload), encoding="utf-8")
    with self.assertRaisesRegex(ValueError, "prompt_sha256"):
        r1.scan_existing_checkpoints(self.exp_root, "relevant", plan, identity)
