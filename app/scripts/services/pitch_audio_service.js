import KeyConverter from "./key_converter.js";

const isBrowser = typeof window !== "undefined";
let piano = null;
let toneModule = null;
let pianoLoadPromise = null;
let didLogLoadError = false;
let recordingDestination = null;
let recordingDestinationConnected = false;
let recordingGainNode = null;
let outputGainNode = null;
let outputLimiterNode = null;
const activeNotes = new Map();
const noteHoldSeconds = 0.72;

function keyToMidiNumber(key, keySignature) {
  const midiNumber = KeyConverter.getKeyNumberForKeyString(key, keySignature);
  return Number.isFinite(midiNumber) ? midiNumber : null;
}

function keyStringToToneNote(keyString) {
  if (!keyString || typeof keyString !== "string") {
    return null;
  }
  const match = /^([a-gA-G])([#b]?)[/](-?\d+)$/.exec(keyString.trim());
  if (!match) {
    return null;
  }
  return `${match[1].toUpperCase()}${match[2]}${match[3]}`;
}

function midiNumberToToneNote(midiNumber) {
  const keyString = KeyConverter.getKeyStringForKeyNumber(midiNumber);
  return keyStringToToneNote(keyString);
}

async function ensurePianoLoaded() {
  if (!isBrowser) {
    return false;
  }
  if (piano) {
    return true;
  }
  if (!pianoLoadPromise) {
    pianoLoadPromise = Promise.all([import("@tonejs/piano/build/piano/Piano.js"), import("tone")])
      .then(async ([pianoModule, tone]) => {
        toneModule = tone;
        if (tone && tone.start) {
          try {
            await tone.start();
          } catch (_error) {
            // Browser blocks starting audio before user gesture; retry on next play.
          }
        }
        const nextPiano = new pianoModule.Piano({ velocities: 8 });
        const context = toneModule.getContext().rawContext;
        outputGainNode = context.createGain();
        outputGainNode.gain.value = 0.72;
        outputLimiterNode = context.createDynamicsCompressor();
        outputLimiterNode.threshold.value = -8;
        outputLimiterNode.knee.value = 12;
        outputLimiterNode.ratio.value = 12;
        outputLimiterNode.attack.value = 0.003;
        outputLimiterNode.release.value = 0.12;
        nextPiano.connect(outputGainNode);
        outputGainNode.connect(outputLimiterNode);
        outputLimiterNode.connect(context.destination);
        await nextPiano.load();
        piano = nextPiano;
        if (recordingDestination && !recordingDestinationConnected) {
          if (!recordingGainNode) {
            recordingGainNode = context.createGain();
            recordingGainNode.gain.value = 0.9;
          }
          outputGainNode.connect(recordingGainNode);
          recordingGainNode.connect(recordingDestination);
          recordingDestinationConnected = true;
        }
        return true;
      })
      .catch(error => {
        if (!didLogLoadError) {
          didLogLoadError = true;
          console.error("Failed to initialize @tonejs/piano", error);
        }
        pianoLoadPromise = null;
        return false;
      });
  }
  return pianoLoadPromise;
}

function playToneNotes(notes, volumePercent) {
  const baseVelocity = Math.max(0, Math.min(100, volumePercent || 0)) / 100;
  const chordScale = 1 / Math.sqrt(Math.max(1, notes.length));
  const velocity = Math.min(0.82, baseVelocity * chordScale);
  if (velocity === 0 || !notes || notes.length === 0 || !piano) {
    return;
  }
  const now = toneModule && typeof toneModule.now === "function" ? toneModule.now() : undefined;
  notes.forEach(note => {
    const releaseAt = activeNotes.get(note);
    if (releaseAt != null && now != null && releaseAt > now) {
      // Retrigger same pitch cleanly to avoid stacking voices and clipping.
      piano.keyUp({ note, time: now });
    }
    piano.keyDown({ note, velocity });
    const nextReleaseAt = now != null ? now + noteHoldSeconds : null;
    activeNotes.set(note, nextReleaseAt);
    piano.keyUp({ note, time: now != null ? nextReleaseAt : "+0.38" });
    if (now == null) {
      setTimeout(() => {
        activeNotes.delete(note);
      }, Math.round(noteHoldSeconds * 1000) + 50);
    }
  });
}

function toVelocity(volumePercent) {
  const baseVelocity = Math.max(0, Math.min(100, volumePercent || 0)) / 100;
  return Math.min(0.82, baseVelocity);
}

export default {
  async noteOnMidiNumber(midiNumber, volumePercent) {
    const note = midiNumberToToneNote(midiNumber);
    if (!note) {
      return;
    }
    const ready = await ensurePianoLoaded();
    if (!ready) {
      return;
    }
    const now = toneModule && typeof toneModule.now === "function" ? toneModule.now() : undefined;
    const releaseAt = activeNotes.get(note);
    if (releaseAt != null && now != null && releaseAt > now) {
      piano.keyUp({ note, time: now });
    }
    piano.keyDown({ note, velocity: toVelocity(volumePercent) });
    activeNotes.set(note, Number.POSITIVE_INFINITY);
  },

  async noteOffMidiNumber(midiNumber) {
    const note = midiNumberToToneNote(midiNumber);
    if (!note) {
      return;
    }
    const ready = await ensurePianoLoaded();
    if (!ready) {
      return;
    }
    const now = toneModule && typeof toneModule.now === "function" ? toneModule.now() : undefined;
    piano.keyUp({ note, time: now != null ? now : undefined });
    activeNotes.delete(note);
  },

  async playMidiNumbers(midiNumbers, volumePercent) {
    if (!midiNumbers || midiNumbers.length === 0) {
      return;
    }
    const notes = midiNumbers.map(midiNumberToToneNote).filter(Boolean);
    if (notes.length === 0) {
      return;
    }
    const ready = await ensurePianoLoaded();
    if (!ready) {
      return;
    }
    playToneNotes(notes, volumePercent);
  },

  async playKeys(keys, keySignature, volumePercent) {
    if (!keys || keys.length === 0) {
      return;
    }
    const notes = keys
      .map(key => keyToMidiNumber(key, keySignature))
      .map(midiNumberToToneNote)
      .filter(Boolean);
    if (notes.length === 0) {
      return;
    }
    const ready = await ensurePianoLoaded();
    if (!ready) {
      return;
    }
    playToneNotes(notes, volumePercent);
  },

  async getRecordingStream() {
    const ready = await ensurePianoLoaded();
    if (!ready || !toneModule) {
      return null;
    }
    if (!recordingDestination) {
      const context = toneModule.getContext().rawContext;
      recordingDestination = context.createMediaStreamDestination();
      if (outputGainNode && !recordingDestinationConnected) {
        if (!recordingGainNode) {
          recordingGainNode = context.createGain();
          recordingGainNode.gain.value = 0.9;
        }
        outputGainNode.connect(recordingGainNode);
        recordingGainNode.connect(recordingDestination);
        recordingDestinationConnected = true;
      }
    }
    return recordingDestination.stream;
  },
};
