import React, { Component } from "react";
import PropTypes from "prop-types";
import classNames from "classnames";
import PitchAudioService from "../services/pitch_audio_service.js";
import MidiService from "../services/midi_service.js";
import MetronomeService from "../services/metronome_service.js";
import AppFreezer from "../AppFreezer.js";
import GameButton from "./game_button.jsx";
import SettingLine from "./setting_line.jsx";
import RangeSettingComponent from "./range_setting_component.jsx";
import KeyConverter from "../services/key_converter.js";

const keyboardToKeyString = {
  a: "c/4",
  w: "c#/4",
  s: "d/4",
  e: "d#/4",
  d: "e/4",
  f: "f/4",
  t: "f#/4",
  g: "g/4",
  y: "g#/4",
  h: "a/4",
  u: "a#/4",
  j: "b/4",
  k: "c/5",
};

const keyLayout = [
  { noteLabel: "C4", keyString: "c/4", keyChar: "A" },
  { noteLabel: "C#4", keyString: "c#/4", keyChar: "W" },
  { noteLabel: "D4", keyString: "d/4", keyChar: "S" },
  { noteLabel: "D#4", keyString: "d#/4", keyChar: "E" },
  { noteLabel: "E4", keyString: "e/4", keyChar: "D" },
  { noteLabel: "F4", keyString: "f/4", keyChar: "F" },
  { noteLabel: "F#4", keyString: "f#/4", keyChar: "T" },
  { noteLabel: "G4", keyString: "g/4", keyChar: "G" },
  { noteLabel: "G#4", keyString: "g#/4", keyChar: "Y" },
  { noteLabel: "A4", keyString: "a/4", keyChar: "H" },
  { noteLabel: "A#4", keyString: "a#/4", keyChar: "U" },
  { noteLabel: "B4", keyString: "b/4", keyChar: "J" },
  { noteLabel: "C5", keyString: "c/5", keyChar: "K" },
];

export default class RecorderView extends Component {
  static propTypes = {
    isActive: PropTypes.bool.isRequired,
    settings: PropTypes.object.isRequired,
  };

  static childContextTypes = {
    isInActiveView: PropTypes.bool,
  };

  getChildContext() {
    return {
      isInActiveView: this.props.isActive,
    };
  }

  constructor(props, context) {
    super(props, context);
    this.state = {
      isRecording: false,
      isPlaying: false,
      isWaveRecording: false,
      recordedEvents: [],
      ignoreVelocity: true,
      velocityCurveExponent: 2.2,
      velocityMinVolume: 0,
      useMetronome: false,
      metronomeBeatDuration: 1000,
      metronomeUseSubdivisionClick: false,
    };
    this.recordStartTime = null;
    this.playbackTimeoutIds = [];
  }

  componentDidMount() {
    this.midiService = new MidiService({
      successCallback: () => {},
      failureCallback: () => {},
      noteOnCallback: this.onMidiNoteOn.bind(this),
      noteOffCallback: this.onMidiNoteOff.bind(this),
      errorCallback: this.onMidiError.bind(this),
      errorResolveCallback: this.onMidiErrorResolve.bind(this),
    });
    this.midiService.setDesiredKeys([], "C");

    this.keyDownHandler = event => {
      if (!this.props.isActive || event.repeat) {
        return;
      }
      const keyString = keyboardToKeyString[event.key.toLowerCase()];
      if (!keyString) {
        return;
      }
      event.preventDefault();
      this.onPlayKey(keyString);
    };
    document.addEventListener("keydown", this.keyDownHandler);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.keyDownHandler);
    this.stopPlayback();
    this.stopRecorderMetronome();
    this.stopWaveRecording();
    if (this.midiService && this.props.settings.midi && this.props.settings.midi.inputs) {
      this.midiService.unlistenToInputs(this.props.settings.midi.inputs.get());
    }
  }

  onMidiError(message) {
    this.setState({ midiErrorMessage: message });
  }

  onMidiErrorResolve() {
    this.setState({ midiErrorMessage: null });
  }

  onMidiInputChange() {
    AppFreezer.trigger("input:changed", parseInt(this.midiSelect.value, 10));
  }

  getPlaybackVolumePercent(velocity) {
    if (this.state.ignoreVelocity || velocity == null) {
      return 55;
    }
    const v = Math.max(1, Math.min(127, velocity));
    const normalized = v / 127;
    const curved = Math.pow(normalized, this.state.velocityCurveExponent);
    const minVolume = Math.max(0, Math.min(95, this.state.velocityMinVolume));
    const scaled = minVolume + curved * (100 - minVolume);
    return Math.max(1, Math.min(100, Math.round(scaled)));
  }

  startRecorderMetronome() {
    if (!this.state.useMetronome) {
      return;
    }
    this.stopRecorderMetronome();
    const beatDuration = this.state.metronomeBeatDuration;
    const useSubdivision = this.state.metronomeUseSubdivisionClick;
    const subdivisionStep = useSubdivision ? beatDuration / 2 : beatDuration;
    this.metronomeTickIndex = 0;
    this.metronomeIntervalId = setInterval(() => {
      const isMainBeat = !useSubdivision || this.metronomeTickIndex % 2 === 0;
      MetronomeService.play(0, !isMainBeat);
      this.metronomeTickIndex++;
    }, subdivisionStep);
    MetronomeService.play(0, false);
  }

  stopRecorderMetronome() {
    if (this.metronomeIntervalId) {
      clearInterval(this.metronomeIntervalId);
      this.metronomeIntervalId = null;
    }
  }

  onMidiNoteOff(keyNumber) {
    if (!this.props.isActive) {
      return;
    }
    PitchAudioService.noteOffMidiNumber(keyNumber);
  }

  onMidiNoteOn(keyNumber, velocity) {
    if (!this.props.isActive) {
      return;
    }
    const volume = this.getPlaybackVolumePercent(velocity);
    PitchAudioService.noteOnMidiNumber(keyNumber, volume);
    if (!this.state.isRecording) {
      return;
    }
    this.setState({
      recordedEvents: this.state.recordedEvents.concat({
        midiNumber: keyNumber,
        velocity,
        time: performance.now() - this.recordStartTime,
      }),
    });
  }

  onPlayKey(keyString) {
    PitchAudioService.playKeys([keyString], "C", 55);
    if (!this.state.isRecording) {
      return;
    }
    this.setState({
      recordedEvents: this.state.recordedEvents.concat({
        keyString,
        time: performance.now() - this.recordStartTime,
      }),
    });
  }

  startRecording() {
    this.stopPlayback();
    this.startRecorderMetronome();
    this.recordStartTime = performance.now();
    this.setState({
      isRecording: true,
      recordedEvents: [],
    });
  }

  stopRecording() {
    if (!this.state.useMetronome) {
      this.stopRecorderMetronome();
    }
    this.exportMidi();
    this.setState({
      isRecording: false,
    });
  }

  stopPlayback() {
    this.playbackTimeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    this.playbackTimeoutIds = [];
    if (!this.state.useMetronome) {
      this.stopRecorderMetronome();
    }
    if (this.state.isPlaying) {
      this.setState({ isPlaying: false });
    }
  }

  clearRecording() {
    this.stopPlayback();
    if (!this.state.useMetronome) {
      this.stopRecorderMetronome();
    }
    this.setState({
      isRecording: false,
      recordedEvents: [],
    });
  }

  getEventMidiNumber(event) {
    if (event.midiNumber != null) {
      return event.midiNumber;
    }
    return KeyConverter.getKeyNumberForKeyString(event.keyString, "C");
  }

  triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  encodeWavFromFloat32(float32, sampleRate) {
    const dataSize = float32.length * 2;
    const wav = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wav);
    const writeString = (offset, text) => {
      for (let i = 0; i < text.length; i++) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < float32.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return wav;
  }

  exportMidi() {
    if (this.state.recordedEvents.length === 0) {
      return;
    }

    const ticksPerQuarter = 480;
    const beatDurationMs = this.state.useMetronome ? this.state.metronomeBeatDuration : 500;
    const tempoMicrosPerQuarter = Math.max(1, Math.round(beatDurationMs * 1000));
    const msPerTick = beatDurationMs / ticksPerQuarter;
    const defaultDurationMs = Math.max(120, Math.round(beatDurationMs * 0.6));

    const recorded = this.state.recordedEvents
      .map(event => ({ ...event, midiNumber: this.getEventMidiNumber(event) }))
      .filter(event => Number.isFinite(event.midiNumber))
      .sort((a, b) => a.time - b.time);

    const events = [];
    recorded.forEach((event, index) => {
      const next = recorded[index + 1];
      const gap = next ? next.time - event.time : defaultDurationMs;
      const noteDurationMs = Math.max(80, Math.min(defaultDurationMs, Math.round(gap * 0.85)));
      events.push({
        atMs: Math.max(0, Math.round(event.time)),
        type: "on",
        midiNumber: event.midiNumber,
        velocity: this.state.ignoreVelocity ? 96 : Math.max(1, event.velocity || 96),
      });
      events.push({
        atMs: Math.max(0, Math.round(event.time + noteDurationMs)),
        type: "off",
        midiNumber: event.midiNumber,
        velocity: 0,
      });
    });

    events.sort((a, b) => a.atMs - b.atMs || (a.type === "off" ? -1 : 1));

    const encodeVarLen = value => {
      let buffer = value & 0x7f;
      const bytes = [];
      while ((value >>= 7) > 0) {
        buffer <<= 8;
        buffer |= (value & 0x7f) | 0x80;
      }
      while (true) {
        bytes.push(buffer & 0xff);
        if (buffer & 0x80) {
          buffer >>= 8;
        } else {
          break;
        }
      }
      return bytes;
    };

    const track = [];
    track.push(0x00, 0xff, 0x51, 0x03);
    track.push((tempoMicrosPerQuarter >> 16) & 0xff);
    track.push((tempoMicrosPerQuarter >> 8) & 0xff);
    track.push(tempoMicrosPerQuarter & 0xff);

    let previousTick = 0;
    events.forEach(event => {
      const tick = Math.max(0, Math.round(event.atMs / msPerTick));
      const delta = Math.max(0, tick - previousTick);
      previousTick = tick;
      track.push(...encodeVarLen(delta));
      track.push(event.type === "on" ? 0x90 : 0x80, event.midiNumber & 0x7f, event.velocity & 0x7f);
    });

    track.push(0x00, 0xff, 0x2f, 0x00);

    const header = [
      0x4d, 0x54, 0x68, 0x64, // MThd
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00, // format 0
      0x00, 0x01, // one track
      (ticksPerQuarter >> 8) & 0xff,
      ticksPerQuarter & 0xff,
      0x4d, 0x54, 0x72, 0x6b, // MTrk
      (track.length >> 24) & 0xff,
      (track.length >> 16) & 0xff,
      (track.length >> 8) & 0xff,
      track.length & 0xff,
    ];

    const bytes = new Uint8Array(header.length + track.length);
    bytes.set(header, 0);
    bytes.set(track, header.length);

    this.triggerDownload(new Blob([bytes], { type: "audio/midi" }), "recorder-export.mid");
  }

  async startWaveRecording() {
    if (this.state.isWaveRecording) {
      return;
    }
    const stream = await PitchAudioService.getRecordingStream();
    if (!stream) {
      this.setState({ midiErrorMessage: "Recorder stream is not available yet. Play a note and retry." });
      return;
    }

    this.waveCaptureChunks = [];
    this.waveCaptureCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.waveCaptureSource = this.waveCaptureCtx.createMediaStreamSource(stream);
    this.waveCaptureProcessor = this.waveCaptureCtx.createScriptProcessor(4096, 1, 1);
    this.waveCaptureProcessor.onaudioprocess = event => {
      const input = event.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(input.length);
      for (let i = 0; i < input.length; i++) {
        // Keep headroom and soft-limit to avoid clipping artifacts.
        const scaled = input[i] * 0.9;
        chunk[i] = Math.tanh(scaled);
      }
      this.waveCaptureChunks.push(chunk);
    };
    this.waveCaptureSource.connect(this.waveCaptureProcessor);
    this.waveCaptureProcessor.connect(this.waveCaptureCtx.destination);

    this.setState({ isWaveRecording: true, midiErrorMessage: null });
  }

  stopWaveRecording() {
    if (!this.state.isWaveRecording) {
      this.setState({ isWaveRecording: false });
      return;
    }
    if (this.waveCaptureProcessor) {
      this.waveCaptureProcessor.disconnect();
      this.waveCaptureProcessor.onaudioprocess = null;
      this.waveCaptureProcessor = null;
    }
    if (this.waveCaptureSource) {
      this.waveCaptureSource.disconnect();
      this.waveCaptureSource = null;
    }
    const sampleRate = this.waveCaptureCtx ? this.waveCaptureCtx.sampleRate : 44100;
    if (this.waveCaptureCtx) {
      this.waveCaptureCtx.close();
      this.waveCaptureCtx = null;
    }

    const chunks = this.waveCaptureChunks || [];
    this.waveCaptureChunks = [];
    if (chunks.length > 0) {
      let total = 0;
      chunks.forEach(chunk => {
        total += chunk.length;
      });
      const pcm = new Float32Array(total);
      let offset = 0;
      chunks.forEach(chunk => {
        pcm.set(chunk, offset);
        offset += chunk.length;
      });
      const wav = this.encodeWavFromFloat32(pcm, sampleRate);
      this.triggerDownload(new Blob([wav], { type: "audio/wav" }), "recorder-live.wav");
    }

    this.setState({ isWaveRecording: false });
  }

  render() {
    const eventsCount = this.state.recordedEvents.length;
    const midiSettings = this.props.settings.midi;
    const midiInputs = midiSettings.inputs.get();
    const hasMidi = midiInputs.length > 0;

    const midiInputSelector = !hasMidi ? null : (
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="recorder_midi_select" style={{ marginRight: 8 }}>
          MIDI input:
        </label>
        <select
          id="recorder_midi_select"
          defaultValue={midiSettings.activeInputIndex || 0}
          onChange={this.onMidiInputChange.bind(this)}
          ref={c => {
            this.midiSelect = c;
          }}
        >
          {midiInputs.map((el, index) => (
            <option key={index} value={index}>
              Device {index + 1}
            </option>
          ))}
        </select>
      </div>
    );

    return (
      <div className={classNames({ trainer: true, trainerHidden2: !this.props.isActive })}>
        <div className="row center-lg center-md center-sm center-xs">
          <div className="col-lg col-md col-sm col-xs leftColumn">
            <div className="game-container content-box">
              <h3>Recorder</h3>
              <div className="settings" style={{ marginBottom: 16 }}>
                <SettingLine className="setting_checkbox" label="Ignore velocity:">
                  <input
                    type="checkbox"
                    checked={this.state.ignoreVelocity}
                    id="recorder_ignore_velocity_checkbox"
                    name="check"
                    onChange={event => this.setState({ ignoreVelocity: event.currentTarget.checked })}
                  />
                  <label htmlFor="recorder_ignore_velocity_checkbox" />
                </SettingLine>
                <RangeSettingComponent
                  rangeMin={1}
                  rangeMax={50}
                  values={Math.round(this.state.velocityCurveExponent * 10)}
                  onChange={value => this.setState({ velocityCurveExponent: value / 10 })}
                  valueToString={el => `${(el / 10).toFixed(1)}`}
                  label={"Velocity curve:"}
                  disabled={this.state.ignoreVelocity}
                />
                <RangeSettingComponent
                  rangeMin={0}
                  rangeMax={80}
                  values={this.state.velocityMinVolume}
                  onChange={value => this.setState({ velocityMinVolume: value })}
                  valueToString={el => `${el}%`}
                  label={"Velocity min:"}
                  disabled={this.state.ignoreVelocity}
                />
                <SettingLine className="setting_checkbox" label="Metronome:">
                  <input
                    type="checkbox"
                    checked={this.state.useMetronome}
                    id="recorder_metronome_checkbox"
                    name="check"
                    onChange={event => {
                      const checked = event.currentTarget.checked;
                      this.setState({ useMetronome: checked }, () => {
                        if (checked) {
                          this.startRecorderMetronome();
                        } else {
                          this.stopRecorderMetronome();
                        }
                      });
                    }}
                  />
                  <label htmlFor="recorder_metronome_checkbox" />
                </SettingLine>
                <RangeSettingComponent
                  rangeMin={300}
                  rangeMax={2000}
                  values={this.state.metronomeBeatDuration}
                  onChange={value =>
                    this.setState({ metronomeBeatDuration: value }, () => {
                      if (this.state.useMetronome) {
                        this.startRecorderMetronome();
                      }
                    })
                  }
                  valueToString={el => `${el}ms`}
                  label={"Metronome beat:"}
                  disabled={!this.state.useMetronome}
                />
                <SettingLine className="setting_checkbox" label="Subdivision click:">
                  <input
                    type="checkbox"
                    checked={this.state.metronomeUseSubdivisionClick}
                    id="recorder_metronome_subdivision_checkbox"
                    name="check"
                    onChange={event => {
                      const checked = event.currentTarget.checked;
                      this.setState({ metronomeUseSubdivisionClick: checked }, () => {
                        if (this.state.useMetronome) {
                          this.startRecorderMetronome();
                        }
                      });
                    }}
                  />
                  <label htmlFor="recorder_metronome_subdivision_checkbox" />
                </SettingLine>
              </div>
              {midiInputSelector}
              {this.state.midiErrorMessage ? <p>{this.state.midiErrorMessage}</p> : null}
              <p>
                Record melody with the same piano sound. Click keys below or use keyboard:
                A W S E D F T G Y H U J K
              </p>
              <div style={{ marginBottom: 16 }}>
                <GameButton
                  label={this.state.isRecording ? "Stop recording MIDI" : "Start recording MIDI"}
                  shortcutLetter="r"
                  primary={!this.state.isRecording}
                  onClick={
                    this.state.isRecording
                      ? this.stopRecording.bind(this)
                      : this.startRecording.bind(this)
                  }
                />
                <GameButton label="Clear" shortcutLetter="c" onClick={this.clearRecording.bind(this)} />
                <GameButton
                  label={this.state.isWaveRecording ? "Stop recording WAV" : "Start recording WAV"}
                  shortcutLetter="w"
                  onClick={
                    this.state.isWaveRecording
                      ? this.stopWaveRecording.bind(this)
                      : this.startWaveRecording.bind(this)
                  }
                />
              </div>
              <p>
                Notes recorded: <strong>{eventsCount}</strong>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {keyLayout.map(note => (
                  <button
                    key={note.keyString}
                    type="button"
                    onClick={this.onPlayKey.bind(this, note.keyString)}
                    style={{ minWidth: 76, padding: "10px 8px" }}
                  >
                    {note.noteLabel}
                    <br />
                    <small>{note.keyChar}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
