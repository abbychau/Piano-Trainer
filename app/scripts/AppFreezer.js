import Freezer from "freezer-js";

let defaultSettings = {
  pitchReading: {
    useAutomaticDifficulty: false,
    automaticDifficulty: {
      accuracyGoal: 0.85,
      timeGoal: 2000,
      amount: 5,
      newNotesShare: 0.6,
    },
    chordSizeRanges: {
      treble: [1, 1],
      bass: [0, 0],
    },
    noteRanges: {
      treble: [0, 7],
      bass: [0, 13],
    },
    maxDistance: 13,
    successSoundVolume: 70,
    playReferenceSound: true,
    referenceSoundVolume: 55,
    useMetronome: false,
    metronomeUseSubdivisionClick: false,
    metronomeBeatDuration: 1000,
    metronomeTimingWindow: 120,
    metronomeBonusCoins: 2,
    keySignature: [7, 7],
    exerciseLength: 4,
    useAccidentals: false,
    tryToUseMidi: true,
    midi: {
      inputs: Freezer.createLeaf([]),
      activeInputIndex: 0,
    },
  },
  rhythmReading: {
    barDuration: 3000,
    offsetMs: 0,
    metronomeUseSubdivisionClick: false,
    labelBeats: true,
    liveBeatBars: false,
    rests: true,
    restProbability: 0.2,
    eighthNotes: true,
    sixteenthNotes: false,
    dottedNotes: false,
    triplets: false,
  },
};

const savedSettings = localStorage.getItem("SheetMusicTutor-settings");
if (savedSettings) {
  const parsedSettings = JSON.parse(savedSettings);
  parsedSettings.pitchReading.midi.inputs = defaultSettings.pitchReading.midi.inputs;
  parsedSettings.pitchReading.noteRanges =
    parsedSettings.pitchReading.noteRanges || defaultSettings.pitchReading.noteRanges;
  parsedSettings.pitchReading.maxDistance =
    parsedSettings.pitchReading.maxDistance == null
      ? defaultSettings.pitchReading.maxDistance
      : parsedSettings.pitchReading.maxDistance;
  parsedSettings.pitchReading.successSoundVolume =
    parsedSettings.pitchReading.successSoundVolume == null
      ? defaultSettings.pitchReading.successSoundVolume
      : parsedSettings.pitchReading.successSoundVolume;
  parsedSettings.pitchReading.playReferenceSound =
    parsedSettings.pitchReading.playReferenceSound == null
      ? defaultSettings.pitchReading.playReferenceSound
      : parsedSettings.pitchReading.playReferenceSound;
  parsedSettings.pitchReading.referenceSoundVolume =
    parsedSettings.pitchReading.referenceSoundVolume == null
      ? defaultSettings.pitchReading.referenceSoundVolume
      : parsedSettings.pitchReading.referenceSoundVolume;
  parsedSettings.pitchReading.useMetronome =
    parsedSettings.pitchReading.useMetronome == null
      ? defaultSettings.pitchReading.useMetronome
      : parsedSettings.pitchReading.useMetronome;
  parsedSettings.pitchReading.metronomeUseSubdivisionClick =
    parsedSettings.pitchReading.metronomeUseSubdivisionClick == null
      ? defaultSettings.pitchReading.metronomeUseSubdivisionClick
      : parsedSettings.pitchReading.metronomeUseSubdivisionClick;
  parsedSettings.pitchReading.metronomeBeatDuration =
    parsedSettings.pitchReading.metronomeBeatDuration == null
      ? defaultSettings.pitchReading.metronomeBeatDuration
      : parsedSettings.pitchReading.metronomeBeatDuration;
  parsedSettings.pitchReading.metronomeTimingWindow =
    parsedSettings.pitchReading.metronomeTimingWindow == null
      ? defaultSettings.pitchReading.metronomeTimingWindow
      : parsedSettings.pitchReading.metronomeTimingWindow;
  parsedSettings.pitchReading.metronomeBonusCoins =
    parsedSettings.pitchReading.metronomeBonusCoins == null
      ? defaultSettings.pitchReading.metronomeBonusCoins
      : parsedSettings.pitchReading.metronomeBonusCoins;
  parsedSettings.rhythmReading = parsedSettings.rhythmReading || defaultSettings.rhythmReading;
  parsedSettings.rhythmReading.offsetMs =
    parsedSettings.rhythmReading.offsetMs == null
      ? defaultSettings.rhythmReading.offsetMs
      : parsedSettings.rhythmReading.offsetMs;
  parsedSettings.rhythmReading.metronomeUseSubdivisionClick =
    parsedSettings.rhythmReading.metronomeUseSubdivisionClick == null
      ? defaultSettings.rhythmReading.metronomeUseSubdivisionClick
      : parsedSettings.rhythmReading.metronomeUseSubdivisionClick;
  parsedSettings.pitchReading.exerciseLength =
    parsedSettings.pitchReading.exerciseLength == null
      ? defaultSettings.pitchReading.exerciseLength
      : parsedSettings.pitchReading.exerciseLength;
  defaultSettings = parsedSettings;
}

const AppFreezer = new Freezer({
  settings: defaultSettings,
});

AppFreezer.on("update", () => {
  const settingsJson = JSON.stringify(AppFreezer.get().settings.toJS());
  localStorage.setItem("SheetMusicTutor-settings", settingsJson);
});

export default AppFreezer;
