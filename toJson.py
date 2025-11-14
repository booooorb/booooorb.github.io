import mne
import numpy as np
import json

EDF_FILE = "SC4001E0-PSG.edf"

CHANNEL_INDEX = 0  # 0 = first channel

raw = mne.io.read_raw_edf(EDF_FILE, preload=True)

data, times = raw[CHANNEL_INDEX:CHANNEL_INDEX + 1]
values = data[0]  # 1D array

TARGET_RATE = 50  # Hz in the game
raw_resampled = raw.copy().resample(TARGET_RATE)
data_rs, times_rs = raw_resampled[CHANNEL_INDEX:CHANNEL_INDEX + 1]
values_rs = data_rs[0]

# Normalize to roughly -1..1
values_rs = values_rs - np.mean(values_rs)
max_abs = np.max(np.abs(values_rs))
if max_abs > 0:
    values_rs = values_rs / max_abs

out = {
    "sampleRate": TARGET_RATE,
    "values": values_rs.tolist()
}

with open("brainwave_runner_data.json", "w") as f:
    json.dump(out, f)

print("Wrote brainwave_runner_data.json with",
      len(values_rs), "samples at", TARGET_RATE, "Hz")
