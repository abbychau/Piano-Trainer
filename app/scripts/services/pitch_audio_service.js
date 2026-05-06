import KeyConverter from "./key_converter.js";

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function keyToFrequency(key, keySignature) {
  const midiNumber = KeyConverter.getKeyNumberForKeyString(key, keySignature);
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

export default {
  playMidiNumbers(midiNumbers, volumePercent) {
    if (!midiNumbers || midiNumbers.length === 0) {
      return;
    }
    const keys = midiNumbers
      .map(number => KeyConverter.getKeyStringForKeyNumber(number))
      .filter(Boolean);
    this.playKeys(keys, "C", volumePercent);
  },

  playKeys(keys, keySignature, volumePercent) {
    const volume = Math.max(0, Math.min(100, volumePercent || 0)) / 100;
    if (volume === 0 || !keys || keys.length === 0) {
      return;
    }

    const output = audioCtx.createGain();
    output.gain.value = volume * 0.2;

    const masterHighpass = audioCtx.createBiquadFilter();
    masterHighpass.type = "highpass";
    masterHighpass.frequency.value = 32;
    masterHighpass.Q.value = 0.7;

    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 7200;
    lowpass.Q.value = 0.5;
    output.connect(masterHighpass);
    masterHighpass.connect(lowpass);
    lowpass.connect(audioCtx.destination);

    keys.forEach(key => {
      const frequency = keyToFrequency(key, keySignature);
      const normalizedPitch = Math.max(0, Math.min(1, (frequency - 130) / 1200));
      const noteGain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      const attack = 0.008;
      const decay = 0.2;
      const sustain = 0.31 - normalizedPitch * 0.1;
      const release = 2.55 - normalizedPitch * 0.95;

      noteGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(1, now + attack);
      noteGain.gain.exponentialRampToValueAtTime(sustain, now + attack + decay);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + release);
      noteGain.connect(output);

      const noteLowpass = audioCtx.createBiquadFilter();
      noteLowpass.type = "lowpass";
      noteLowpass.frequency.value = 7600 - normalizedPitch * 3600;
      noteLowpass.Q.value = 0.45;
      noteLowpass.connect(noteGain);

      const partials = [
        { ratio: 1, type: "triangle", gain: 0.62, detune: -1.9 },
        { ratio: 1, type: "triangle", gain: 0.62, detune: 1.9 },
        { ratio: 2, type: "sine", gain: 0.12, detune: 0 },
        { ratio: 3, type: "sine", gain: 0.05, detune: -1.0 },
        { ratio: 4, type: "sine", gain: 0.024, detune: 0.9 },
      ];

      partials.forEach(partial => {
        const osc = audioCtx.createOscillator();
        osc.type = partial.type;
        const inharmonicity = 1 + 0.00025 * Math.pow(partial.ratio, 2) * (1 - normalizedPitch * 0.45);
        osc.frequency.value = frequency * partial.ratio * inharmonicity;
        const bassDetuneScale = 0.35 + normalizedPitch * 0.65;
        osc.detune.value =
          partial.detune * bassDetuneScale + (Math.random() * 0.8 - 0.4) * bassDetuneScale;
        const wobble = audioCtx.createOscillator();
        const wobbleGain = audioCtx.createGain();
        wobble.frequency.value = 4.5 + Math.random() * 1.2;
        wobbleGain.gain.value = 1.2 * (0.45 + normalizedPitch * 0.55);
        wobble.connect(wobbleGain);
        wobbleGain.connect(osc.detune);
        const stringGain = audioCtx.createGain();
        const highPitchTaming = 1 - normalizedPitch * (partial.ratio >= 3 ? 0.48 : 0.22);
        const bassDefinition = partial.ratio === 1 ? 1 + (1 - normalizedPitch) * 0.28 : 1;
        stringGain.gain.value = partial.gain * highPitchTaming * bassDefinition;
        osc.connect(stringGain);
        stringGain.connect(noteLowpass);
        osc.start(now);
        wobble.start(now);
        osc.stop(now + attack + decay + release + 0.08);
        wobble.stop(now + attack + decay + release + 0.08);
      });

      // Add a clean fundamental layer for bass note intelligibility.
      const bassFundamentalGain = (1 - normalizedPitch) * 0.2;
      if (bassFundamentalGain > 0.01) {
        const fundamental = audioCtx.createOscillator();
        fundamental.type = "sine";
        fundamental.frequency.value = frequency;
        const fundamentalGain = audioCtx.createGain();
        fundamentalGain.gain.setValueAtTime(0.0001, now);
        fundamentalGain.gain.exponentialRampToValueAtTime(bassFundamentalGain, now + 0.012);
        fundamentalGain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + attack + decay + Math.max(1.4, release * 0.82),
        );
        fundamental.connect(fundamentalGain);
        fundamentalGain.connect(noteLowpass);
        fundamental.start(now);
        fundamental.stop(now + attack + decay + release + 0.12);
      }

      const bodyResonance = audioCtx.createBiquadFilter();
      bodyResonance.type = "bandpass";
      bodyResonance.frequency.value = 230 + normalizedPitch * 180;
      bodyResonance.Q.value = 0.8;
      const bodyGain = audioCtx.createGain();
      bodyGain.gain.value = 0.03 + normalizedPitch * 0.04;
      noteGain.connect(bodyResonance);
      bodyResonance.connect(bodyGain);
      bodyGain.connect(output);

      const bassPresence = audioCtx.createBiquadFilter();
      bassPresence.type = "peaking";
      bassPresence.frequency.value = 120 + (1 - normalizedPitch) * 70;
      bassPresence.Q.value = 1.1;
      bassPresence.gain.value = 2.6 * (1 - normalizedPitch);
      noteGain.connect(bassPresence);
      bassPresence.connect(output);

      const mudCut = audioCtx.createBiquadFilter();
      mudCut.type = "peaking";
      mudCut.frequency.value = 220 + (1 - normalizedPitch) * 100;
      mudCut.Q.value = 1.2;
      mudCut.gain.value = -2.2 * (1 - normalizedPitch);
      noteGain.connect(mudCut);
      mudCut.connect(output);

      const soundboardResonators = [
        { freq: 98, q: 3.6, gain: 0.03 },
        { freq: 196, q: 3.2, gain: 0.026 },
        { freq: 294, q: 2.6, gain: 0.02 },
      ];
      soundboardResonators.forEach(res => {
        const band = audioCtx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = res.freq;
        band.Q.value = res.q;
        const g = audioCtx.createGain();
        g.gain.value = res.gain * (0.2 + normalizedPitch * 0.8);
        noteGain.connect(band);
        band.connect(g);
        g.connect(output);
      });

      const hammerNoise = audioCtx.createBufferSource();
      const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.05), audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      hammerNoise.buffer = buffer;
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = "highpass";
      noiseFilter.frequency.value = 2500;
      const noiseLowpass = audioCtx.createBiquadFilter();
      noiseLowpass.type = "lowpass";
      noiseLowpass.frequency.value = 6500 - normalizedPitch * 1800;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.02;
      hammerNoise.connect(noiseFilter);
      noiseFilter.connect(noiseLowpass);
      noiseLowpass.connect(noiseGain);
      noiseGain.connect(noteGain);
      hammerNoise.start(now);
      hammerNoise.stop(now + 0.045);
    });
  },
};
