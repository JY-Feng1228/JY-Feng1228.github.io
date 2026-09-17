# Project evidence excerpt: EXP011 time-boundary regression tests
# Source: tests/test_exp011_protocol.py, lines 50-57 and 75-87.
# Only the enclosing class indentation is removed.
# This excerpt depends on the original test fixtures/imports; it is not a standalone test file.
# No test run was performed while preparing this excerpt.

def test_seasonal_naive_never_reads_after_forecast_origin(self) -> None:
    index = pd.date_range("2022-12-01", "2023-02-01", tz="UTC", freq="D")
    y = target_frame(index)
    target = pd.DatetimeIndex([pd.Timestamp("2023-01-20", tz="UTC")])
    prediction = baseline.train_predict_seasonal_naive(y, target, horizon=8)
    expected = y.loc[pd.Timestamp("2023-01-06", tz="UTC")]
    pd.testing.assert_series_equal(prediction.iloc[0], expected, check_names=False)
    self.assertLessEqual(target[0] - pd.Timedelta(days=14), target[0] - pd.Timedelta(days=8))

def test_text_scaler_is_fit_on_training_rows_only(self) -> None:
    dates = pd.date_range("2021-12-29", periods=6, tz="UTC", freq="D")
    base_values = pd.DataFrame({"Date": dates, "a": [1, 2, 100, 200, 300, 400], "b": [2, 4, 200, 400, 600, 800]})
    with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
        for directory, multiplier in [(first, 1), (second, 1000)]:
            frame = base_values.copy()
            frame.loc[2:, ["a", "b"]] *= multiplier
            frame.to_csv(Path(directory) / "text_features.csv", index=False)
            with (Path(directory) / "hier_clusters_feat.pkl").open("wb") as handle:
                pickle.dump({1: ["a", "b"]}, handle)
        one = baseline.load_text_cluster_features(first, 1, "2022-01-01T00:00:00+00:00")
        two = baseline.load_text_cluster_features(second, 1, "2022-01-01T00:00:00+00:00")
        np.testing.assert_allclose(one.iloc[:2].to_numpy(), two.iloc[:2].to_numpy())
