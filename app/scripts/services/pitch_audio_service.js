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
    output.gain.value = volume * 0.26;

    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 8200;
    lowpass.Q.value = 0.85;
    output.connect(lowpass);
    lowpass.connect(audioCtx.destination);

    keys.forEach(key => {
      const frequency = keyToFrequency(key, keySignature);
      const noteGain = audioCtx.createGain();
      noteGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(1, audioCtx.currentTime + 0.006);
      noteGain.gain.exponentialRampToValueAtTime(0.36, audioCtx.currentTime + 0.16);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.8);
      noteGain.connect(output);

      const stringDetunes = [-6, 0, 6];
      stringDetunes.forEach(detune => {
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        const stringGain = audioCtx.createGain();
        stringGain.gain.value = 0.3;
        osc.connect(stringGain);
        stringGain.connect(noteGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.85);
      });

      const octave = audioCtx.createOscillator();
      octave.type = "sine";
      octave.frequency.value = frequency * 2;
      const octaveGain = audioCtx.createGain();
      octaveGain.gain.value = 0.24;
      octave.connect(octaveGain);
      octaveGain.connect(noteGain);
      octave.start();
      octave.stop(audioCtx.currentTime + 1.85);

      const twelfth = audioCtx.createOscillator();
      twelfth.type = "triangle";
      twelfth.frequency.value = frequency * 3;
      const twelfthGain = audioCtx.createGain();
      twelfthGain.gain.value = 0.1;
      twelfth.connect(twelfthGain);
      twelfthGain.connect(noteGain);
      twelfth.start();
      twelfth.stop(audioCtx.currentTime + 1.6);

      const hammerNoise = audioCtx.createBufferSource();
      const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.05), audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      hammerNoise.buffer = buffer;
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = "highpass";
      noiseFilter.frequency.value = 3200;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.06;
      hammerNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(noteGain);
      hammerNoise.start();
      hammerNoise.stop(audioCtx.currentTime + 0.05);
    });
  },
};
