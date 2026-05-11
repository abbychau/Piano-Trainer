import _ from "lodash";

import KeyConverter from "../services/key_converter.js";
import LevelService from "../services/level_service.js";
import Vex from "vexflow";

const baseNotes = "cdefgab".split("");

const options = {
  defaultChordsPerBar: 4,
  levels: {
    bass: [2, 3],
    treble: [4, 5],
  },
  maximumInterval: 12,
};

function getClefNotes(clef) {
  const levels = clef === "treble" ? [4, 5] : [2, 3];
  return _.flatten(levels.map(noteLevel => baseNotes.map(el => el + "/" + noteLevel)));
}

function sampleWithoutReplacement(options) {
  const randomOptionIndex = _.random(0, options.length - 1);
  const option = options.splice(randomOptionIndex, 1)[0];
  return option;
}

function randomInvokeAOrB(probability, functionA, functionB) {
  if (Math.random() < probability) {
    return functionA();
  }
  return functionB();
}

function noteOptionToKeyString(noteOption) {
  if (_.isString(noteOption)) {
    return noteOption;
  }
  if (!noteOption || !noteOption.note) {
    return null;
  }
  if (!noteOption.modifier) {
    return noteOption.note;
  }
  const [note, octave] = noteOption.note.split("/");
  return `${note}${noteOption.modifier}/${octave}`;
}

function keyStringToDiatonicStepIndex(clef, keyString) {
  if (!keyString) {
    return null;
  }
  const canonical = KeyConverter.getCanonicalKeyString(keyString);
  const match = canonical.match(/^([a-g])[#b]*\/(\d+)$/);
  if (!match) {
    return null;
  }
  const naturalKey = `${match[1]}/${match[2]}`;
  return getClefNotes(clef).indexOf(naturalKey);
}

export default {
  getPitchExerciseLength: function(settings) {
    const value = parseInt(settings && settings.exerciseLength, 10);
    const validLengths = [2, 4, 8, 16];
    return validLengths.indexOf(value) > -1 ? value : options.defaultChordsPerBar;
  },

  generateKeySignature: function(settings) {
    const keySignatureIndex = _.sample(
      _.range(settings.keySignature[0], settings.keySignature[1] + 1),
    );
    return KeyConverter.keySignatureValueToString(keySignatureIndex);
  },

  generateEmptyRhythmBar: function() {
    return {
      keys: {
        treble: [],
        bass: [],
      },
      durations: [],
    };
  },

  generateRhythmBar: function(settings) {
    const calcBarLength = durations => {
      return durations.map(el => 1 / Math.abs(el)).reduce((a, b) => a + b, 0);
    };

    const generateRandomDurations = () => {
      const durations = [];
      while (calcBarLength(durations) < 1) {
        const possibleNotes = _.flatten([
          [4, 2],
          settings.eighthNotes ? 8 : null,
          settings.sixteenthNotes ? 16 : null,
        ]);

        let newDuration = _.sample(possibleNotes);
        if (settings.rests && Math.random() < settings.restProbability) {
          newDuration *= -1;
        }
        if (calcBarLength(durations.concat(newDuration)) <= 1) {
          durations.push(newDuration);
        }
      }

      return _.shuffle(durations);
    };

    let durations = generateRandomDurations();
    while (durations.every(el => el < 0)) {
      durations = generateRandomDurations();
    }

    // durations = [4, 2, -4, 4];

    const staveNotes = durations.map(
      duration =>
        new Vex.Flow.StaveNote({
          clef: "treble",
          keys: ["a/4"],
          duration: duration > 0 ? `${duration}` : `${duration}r`,
        }),
    );

    return {
      keys: {
        treble: staveNotes,
        bass: [],
      },
      durations,
    };
  },

  getClefAmounts: function(settings, onePerTime, level) {
    const getTrebleProbability = () => {
      const amounts = {
        new: level.keys.treble.concat(level.keys.bass).length,
        old: LevelService.getAllNotesUntilLevelIndex(level.index).length,
        trebleAndNew: level.keys.treble.length,
        trebleAndOld: LevelService.getAllNotesUntilLevelIndex(level.index, "treble").length,
      };
      if (amounts.new === amounts.trebleAndNew && amounts.old === amounts.trebleAndOld) {
        // there are no bass notes
        return 1;
      }

      const frequencies = {
        new: settings.automaticDifficulty.newNotesShare,
        trebleGivenNew: amounts.trebleAndNew / (amounts.new || 1),
        trebleGivenOld: amounts.trebleAndOld / (amounts.old || 1),
      };
      const trebleProbability =
        frequencies.trebleGivenNew * frequencies.new +
        frequencies.trebleGivenOld * (1 - frequencies.new);
      return trebleProbability;
    };

    if (onePerTime) {
      if (level) {
        const trebleProbability = getTrebleProbability();
        if (Math.random() <= trebleProbability) {
          return [1, 0];
        }
        return [0, 1];
      }
      const lengths = {
        treble: _.max(settings.chordSizeRanges.treble),
        bass: _.max(settings.chordSizeRanges.bass),
      };
      if (lengths.treble > 0 && lengths.bass > 0) {
        return _.sample([[0, 1], [1, 0]]);
      }
      if (lengths.treble === 0) {
        return [0, 1];
      }
      return [1, 0];
    }
    if (level) {
      // todo: handle possibility that a level doesn't demand the onePerTime limit
      return this.getClefAmounts(settings, true, level);
    }
    return ["treble", "bass"].map(clef => _.random.apply(_, settings.chordSizeRanges[clef]));
  },

  generateBars: function(settings, level, onePerTime) {
    const chordsPerBar = this.getPitchExerciseLength(settings);
    const previousNoteSetByClef = {
      treble: null,
      bass: null,
    };
    const [trebleNotes, bassNotes] = _.unzip(
      _.range(0, chordsPerBar).map(() => {
        const generatePossibleNotes = clef => {
          if (level) {
            return {
              new: level.keys[clef],
              old: LevelService.getAllNotesUntilLevelIndex(level.index, clef),
            };
          }
          const noteRange = settings.noteRanges
            ? settings.noteRanges[clef]
            : [0, getClefNotes(clef).length - 1];
          return getClefNotes(clef).slice(noteRange[0], noteRange[1] + 1);
        };

        const [possibleTrebleNotes, possibleBassNotes] = [
          generatePossibleNotes("treble"),
          generatePossibleNotes("bass"),
        ];

        const [trebleAmount, bassAmount] = this.getClefAmounts(settings, onePerTime, level);

        // trebleAmount bassAmount
        // if length === 0 then amounts cannot be more than 0

        const trebleNote = this.generateNotesForBeat(
          settings,
          "treble",
          trebleAmount,
          possibleTrebleNotes,
          previousNoteSetByClef.treble,
        );
        const bassNote = this.generateNotesForBeat(
          settings,
          "bass",
          bassAmount,
          possibleBassNotes,
          previousNoteSetByClef.bass,
        );

        previousNoteSetByClef.treble = trebleAmount > 0 ? trebleNote.getKeys() : null;
        previousNoteSetByClef.bass = bassAmount > 0 ? bassNote.getKeys() : null;

        return [trebleNote, bassNote];
      }),
    );

    return {
      treble: trebleNotes,
      bass: bassNotes,
    };
  },

  generateNoteSet: function(settings, amount, _possibleNotes) {
    if (_.isArray(_possibleNotes)) {
      const possibleNotes = _.clone(_possibleNotes);

      return _.times(amount, () => {
        return sampleWithoutReplacement(possibleNotes);
      });
    }

    const newPossibleNotes = _.clone(_possibleNotes.new);
    const oldPossibleNotes = _.clone(_possibleNotes.old);

    return _.times(amount, () => {
      const bothOptionsAreNotEmpty = newPossibleNotes.length > 0 && oldPossibleNotes.length > 0;
      const newNoteProbability = bothOptionsAreNotEmpty
        ? settings.automaticDifficulty.newNotesShare
        : newPossibleNotes.length > 0 ? 1 : 0;

      return randomInvokeAOrB(
        newNoteProbability,
        () => sampleWithoutReplacement(newPossibleNotes),
        () => sampleWithoutReplacement(oldPossibleNotes),
      );
    });
  },

  ensureInterval: function(keyStrings) {
    const keyNumbers = keyStrings.map(keyString => {
      return KeyConverter.getKeyNumberForKeyString(keyString, "C");
    });
    return options.maximumInterval >= _.max(keyNumbers) - _.min(keyNumbers);
  },

  limitPossibleNotesByMaxDistance(clef, possibleNotes, previousNoteSet, maxDistance) {
    if (!previousNoteSet || maxDistance == null || maxDistance < 0) {
      return possibleNotes;
    }

    const previousIndexes = previousNoteSet
      .map(noteOptionToKeyString)
      .map(keyString => keyStringToDiatonicStepIndex(clef, keyString))
      .filter(index => index > -1);
    if (previousIndexes.length === 0) {
      return possibleNotes;
    }

    const isWithinDistance = noteOption => {
      const keyString = noteOptionToKeyString(noteOption);
      const index = keyStringToDiatonicStepIndex(clef, keyString);
      if (index == null || index < 0) {
        return true;
      }
      return previousIndexes.some(previousIndex => Math.abs(previousIndex - index) <= maxDistance);
    };

    if (_.isArray(possibleNotes)) {
      const limited = possibleNotes.filter(isWithinDistance);
      return limited.length > 0 ? limited : possibleNotes;
    }

    const limited = {
      new: possibleNotes.new.filter(isWithinDistance),
      old: possibleNotes.old.filter(isWithinDistance),
    };
    if (limited.new.length === 0 && limited.old.length === 0) {
      return possibleNotes;
    }
    return limited;
  },

  generateNotesForBeat(settings, clef, amount, possibleNotes, previousNoteSet) {
    const chordsPerBar = this.getPitchExerciseLength(settings);
    if (amount === 0) {
      const rest = new Vex.Flow.StaveNote({
        clef: clef,
        keys: [clef === "treble" ? "a/4" : "c/3"],
        duration: `${chordsPerBar}r`,
      });
      return rest;
    }

    const maxDistance = parseInt(settings.maxDistance, 10);
    const limitedPossibleNotes = this.limitPossibleNotesByMaxDistance(
      clef,
      possibleNotes,
      previousNoteSet,
      maxDistance,
    );

    let randomNoteSet = this.generateNoteSet(settings, amount, limitedPossibleNotes);
    while (!this.ensureInterval(randomNoteSet)) {
      randomNoteSet = this.generateNoteSet(settings, amount, limitedPossibleNotes);
    }

    const staveChord = new Vex.Flow.StaveNote({
      clef: clef,
      keys: randomNoteSet.sort((keyA, keyB) => {
        return (
          KeyConverter.getKeyNumberForKeyString(keyA, "C") -
          KeyConverter.getKeyNumberForKeyString(keyB, "C")
        );
      }),
      duration: `${chordsPerBar}`,
    });

    randomNoteSet.forEach(({ note, modifier }, index) => {
      if (modifier) {
        staveChord.addAccidental(index, new Vex.Flow.Accidental(modifier));
      }
    });

    return staveChord;
  },
};
