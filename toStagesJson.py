import mne
import json

# === EDIT THIS: your hypnogram EDF filename ===
EDF_FILE = "SC4001EC-Hypnogram.edf"

# This is the right way to get all sleep stage epochs from a hypnogram EDF:
ann = mne.read_annotations(EDF_FILE)

print("Number of annotations in hypnogram:", len(ann))
print("Unique labels:", sorted(set(ann.description)))

# Map EDF annotation text -> short stage codes for the game
STAGE_MAP = {
    "Sleep stage W": "W",
    "Sleep stage 1": "N1",
    "Sleep stage 2": "N2",
    "Sleep stage 3": "N3",
    "Sleep stage 4": "N4",
    "Sleep stage R": "REM",
    # you can ignore these (or map them if you want):
    "Sleep stage ?": None,
    "Movement time": None,
}

segments = []
for onset, dur, descr in zip(ann.onset, ann.duration, ann.description):
    code = STAGE_MAP.get(descr, None)
    if code is None:
        continue
    # onset is "seconds from recording start"
    segments.append({"t": float(onset), "stage": code})

# Sort by time
segments.sort(key=lambda s: s["t"])

if not segments:
    raise RuntimeError("No sleep stage annotations matched STAGE_MAP. "
                       "Check the printed 'Unique labels' above.")

# Total duration: last onset + its duration
total_duration = float(ann.onset[-1] + ann.duration[-1])

out = {
    "totalDurationSec": total_duration,
    "segments": segments,
}

with open("brainwave_stages.json", "w", encoding="utf-8") as f:
    json.dump(out, f)

print("Wrote brainwave_stages.json with", len(segments), "segments")
print("Total duration ~", total_duration, "seconds")
