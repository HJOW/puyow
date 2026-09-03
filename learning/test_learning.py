"""learning.py의 체크포인트 자동 재개 동작을 확인하는 단위 테스트다."""

import unittest
from pathlib import Path
from unittest import mock

import torch

import learning as training


class ExistingPolicyLoadTest(unittest.TestCase):
	"""기존 출력 파일이 있을 때만 모델 가중치를 복원하는지 확인한다."""

	def test_existing_checkpoint_restores_policy_weights(self) -> None:
		checkpoint_path = Path("resume.pt")
		saved_policy = training.PolicyNetwork()
		with torch.no_grad():
			for parameter in saved_policy.parameters():
				parameter.fill_(0.25)
		checkpoint = {
			"model": saved_policy.state_dict(),
			"observation_size": training.OBSERVATION_SIZE,
			"action_count": training.ACTION_COUNT,
			"seed": 2026,
		}

		loaded_policy = training.PolicyNetwork()
		with mock.patch.object(Path, "exists", return_value=True), \
			mock.patch.object(Path, "is_file", return_value=True), \
			mock.patch.object(training.torch, "load", return_value=checkpoint) as load_mock:
			resumed = training.load_existing_policy(checkpoint_path, loaded_policy, torch.device("cpu"))

		self.assertTrue(resumed)
		load_mock.assert_called_once_with(checkpoint_path, map_location=torch.device("cpu"), weights_only=True)
		for saved, loaded in zip(saved_policy.parameters(), loaded_policy.parameters()):
			self.assertTrue(torch.equal(saved, loaded))

	def test_missing_checkpoint_keeps_new_policy(self) -> None:
		checkpoint_path = Path("new.pt")
		policy = training.PolicyNetwork()

		with mock.patch.object(Path, "exists", return_value=False):
			self.assertFalse(training.load_existing_policy(checkpoint_path, policy, torch.device("cpu")))

	def test_incompatible_checkpoint_is_rejected(self) -> None:
		checkpoint_path = Path("incompatible.pt")
		checkpoint = {
			"model": training.PolicyNetwork().state_dict(),
			"observation_size": training.OBSERVATION_SIZE - 1,
			"action_count": training.ACTION_COUNT,
		}

		with mock.patch.object(Path, "exists", return_value=True), \
			mock.patch.object(Path, "is_file", return_value=True), \
			mock.patch.object(training.torch, "load", return_value=checkpoint):
			with self.assertRaisesRegex(ValueError, "관측값 또는 행동 계약"):
				training.load_existing_policy(checkpoint_path, training.PolicyNetwork(), torch.device("cpu"))


if __name__ == "__main__":
	unittest.main()
