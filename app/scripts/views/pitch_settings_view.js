import React, { Component } from "react";
import PropTypes from "prop-types";
import RangeSettingComponent from "./range_setting_component";
import SettingLine from "./setting_line";
import KeyConverter from "../services/key_converter";
import AppFreezer from "../AppFreezer.js";
import _ from "lodash";
import AnalyticsService from "../services/analytics_service.js";

export default class PitchSettingsView extends Component {
  static propTypes = {
    settings: PropTypes.object,
  };

  constructor(props, context) {
    super(props, context);
  }

  buildStateChanger(stateKey) {
    return newValue => {
      if (_.isObject(newValue)) {
        const keys = stateKey.split(".");
        const keyToChange = _.reduce(keys, (acc, key) => acc[key], this.props.settings);
        keyToChange.reset(newValue);
      } else {
        // if stateKey points to a primitive, we cannot use reset
        const keys = stateKey.split(".");
        const parentToChange = _.reduce(
          keys.slice(0, -1),
          (acc, key) => acc[key],
          this.props.settings,
        );
        parentToChange.set({
          [keys.slice(-1)[0]]: newValue,
        });
      }

      AnalyticsService.sendEvent(
        "PitchReading-Settings",
        stateKey + " - " + JSON.stringify(newValue),
      );
    };
  }

  buildCheckboxStateChanger(stateKey) {
    const stateChanger = this.buildStateChanger(stateKey);
    return function(event) {
      return stateChanger(event.currentTarget.checked);
    };
  }

  onMidiSelectChange() {
    AppFreezer.trigger("input:changed", parseInt(this.midiSelect.value, 10));
  }

  onExerciseLengthChange(event) {
    const nextLength = parseInt(event.currentTarget.value, 10);
    this.buildStateChanger("exerciseLength")(nextLength);
  }

  resetPitchSettingsToDefault() {
    const defaultPitchReadingSettings = {
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
        activeInputIndex: 0,
      },
    };

    const midiInputs = this.props.settings.midi.inputs;
    this.props.settings.reset({
      ...defaultPitchReadingSettings,
      midi: {
        ...defaultPitchReadingSettings.midi,
        inputs: midiInputs,
      },
    });

    AnalyticsService.sendEvent("PitchReading-Settings", "reset-all-to-default");
  }

  pitchRangeValueToString(clef, index) {
    const levels = clef === "treble" ? [4, 5] : [2, 3];
    const notes = "cdefgab".split("");
    const key = levels
      .map(level => notes.map(note => `${note}/${level}`))
      .reduce((acc, curr) => acc.concat(curr), [])[index];
    const [note, octave] = key.split("/");
    return `${note.toUpperCase()}${octave}`;
  }

  render() {
    const midiSettings = this.props.settings.midi;
    const midiInputs = midiSettings.inputs.get();
    const isMidiAvailable = midiInputs.length > 0;
    const tryToUseMidi = this.props.settings.tryToUseMidi;
    const deviceSelector = !isMidiAvailable ? null : (
      <div>
        <SettingLine className="setting_checkbox" label="Use Midi:">
          <input
            type="checkbox"
            checked={tryToUseMidi}
            id="try_to_use_midi_checkbox"
            name="check"
            onChange={this.buildCheckboxStateChanger("tryToUseMidi")}
          />
          <label htmlFor="try_to_use_midi_checkbox" />
        </SettingLine>
        {tryToUseMidi ? (
          <SettingLine label="Midi device">
            <select
              name="select"
              onChange={this.onMidiSelectChange.bind(this)}
              defaultValue={midiSettings.currentInput}
              ref={c => {
                this.midiSelect = c;
              }}
            >
              {midiInputs.map((el, index) => {
                return (
                  <option value={index} key={index}>
                    Device {index + 1}
                  </option>
                );
              })}
            </select>
          </SettingLine>
        ) : null}
      </div>
    );

    const useAutomaticDifficulty = this.props.settings.useAutomaticDifficulty;

    const accuracyStateChanger = this.buildStateChanger("automaticDifficulty.accuracyGoal");
    const newNotesShareStateChanger = this.buildStateChanger("automaticDifficulty.newNotesShare");

    const automaticDifficultySection = (
      <div>
        <RangeSettingComponent
          rangeMin={100}
          rangeMax={10000}
          values={this.props.settings.automaticDifficulty.timeGoal}
          onChange={this.buildStateChanger("automaticDifficulty.timeGoal")}
          valueToString={el => `${el}ms`}
          label={"Time goal"}
        />
        <RangeSettingComponent
          rangeMin={50}
          rangeMax={99}
          values={Math.floor(this.props.settings.automaticDifficulty.accuracyGoal * 100)}
          onChange={value => accuracyStateChanger(value / 100)}
          valueToString={el => `${el}%`}
          label={"Accuracy goal"}
        />
        <RangeSettingComponent
          rangeMin={10}
          rangeMax={100}
          values={Math.floor(this.props.settings.automaticDifficulty.newNotesShare * 100)}
          onChange={value => newNotesShareStateChanger(value / 100)}
          valueToString={el => `${el}%`}
          label={"Share of new notes"}
        />
      </div>
    );

    const manualDifficultySection = (
      <div>
        <SettingLine className="setting_checkbox" label="Metronome:">
          <input
            type="checkbox"
            checked={this.props.settings.useMetronome}
            id="pitch_metronome_checkbox"
            name="check"
            onChange={this.buildCheckboxStateChanger("useMetronome")}
          />
          <label htmlFor="pitch_metronome_checkbox" />
        </SettingLine>
        <RangeSettingComponent
          rangeMin={300}
          rangeMax={2000}
          values={this.props.settings.metronomeBeatDuration}
          onChange={this.buildStateChanger("metronomeBeatDuration")}
          valueToString={el => `${el}ms`}
          label={"Metronome beat"}
          disabled={!this.props.settings.useMetronome}
        />
        <SettingLine className="setting_checkbox" label="Subdivision click:">
          <input
            type="checkbox"
            checked={this.props.settings.metronomeUseSubdivisionClick}
            id="pitch_metronome_subdivision_checkbox"
            name="check"
            onChange={this.buildCheckboxStateChanger("metronomeUseSubdivisionClick")}
          />
          <label htmlFor="pitch_metronome_subdivision_checkbox" />
        </SettingLine>
        <RangeSettingComponent
          rangeMin={40}
          rangeMax={300}
          values={this.props.settings.metronomeTimingWindow}
          onChange={this.buildStateChanger("metronomeTimingWindow")}
          valueToString={el => `${el}ms`}
          label={"Timing window"}
          disabled={!this.props.settings.useMetronome}
        />
        <RangeSettingComponent
          rangeMin={1}
          rangeMax={10}
          values={this.props.settings.metronomeBonusCoins}
          onChange={this.buildStateChanger("metronomeBonusCoins")}
          valueToString={el => `+${el}`}
          label={"On-beat bonus"}
          disabled={!this.props.settings.useMetronome}
        />
        <RangeSettingComponent
          rangeMin={0}
          rangeMax={100}
          values={this.props.settings.successSoundVolume}
          onChange={this.buildStateChanger("successSoundVolume")}
          valueToString={el => `${el}%`}
          label={"Volume"}
        />
        <SettingLine className="setting_checkbox" label="Reference sound:">
          <input
            type="checkbox"
            checked={this.props.settings.playReferenceSound}
            id="reference_sound_checkbox"
            name="check"
            onChange={this.buildCheckboxStateChanger("playReferenceSound")}
          />
          <label htmlFor="reference_sound_checkbox" />
        </SettingLine>
        <RangeSettingComponent
          rangeMin={0}
          rangeMax={100}
          values={this.props.settings.referenceSoundVolume}
          onChange={this.buildStateChanger("referenceSoundVolume")}
          valueToString={el => `${el}%`}
          label={"Reference volume"}
          disabled={!this.props.settings.playReferenceSound}
        />
        <SettingLine label="Exercise length">
          <select
            name="pitch_exercise_length"
            value={this.props.settings.exerciseLength || 4}
            onChange={this.onExerciseLengthChange.bind(this)}
          >
            {[2, 4, 8, 16].map(length => (
              <option value={length} key={length}>
                {length} notes
              </option>
            ))}
          </select>
        </SettingLine>
        <RangeSettingComponent
          rangeMin={0}
          rangeMax={5}
          values={{
            from: this.props.settings.chordSizeRanges.treble[0],
            to: this.props.settings.chordSizeRanges.treble[1],
          }}
          onChange={this.buildStateChanger("chordSizeRanges.treble")}
          label={"Treble notes/chord"}
          disabled={!isMidiAvailable}
        />
        <RangeSettingComponent
          rangeMin={0}
          rangeMax={5}
          values={{
            from: this.props.settings.chordSizeRanges.bass[0],
            to: this.props.settings.chordSizeRanges.bass[1],
          }}
          onChange={this.buildStateChanger("chordSizeRanges.bass")}
          label={"Bass notes/chord"}
          disabled={!isMidiAvailable}
        />
        <RangeSettingComponent
          rangeMin={0}
          rangeMax={13}
          values={{
            from: this.props.settings.noteRanges.treble[0],
            to: this.props.settings.noteRanges.treble[1],
          }}
          onChange={this.buildStateChanger("noteRanges.treble")}
          valueToString={index => this.pitchRangeValueToString("treble", index)}
          label={"Treble note range"}
        />
        <RangeSettingComponent
          rangeMin={0}
          rangeMax={13}
          values={{
            from: this.props.settings.noteRanges.bass[0],
            to: this.props.settings.noteRanges.bass[1],
          }}
          onChange={this.buildStateChanger("noteRanges.bass")}
          valueToString={index => this.pitchRangeValueToString("bass", index)}
          label={"Bass note range"}
        />
        <RangeSettingComponent
          rangeMin={0}
          rangeMax={14}
          values={{
            from: this.props.settings.keySignature[0],
            to: this.props.settings.keySignature[1],
          }}
          onChange={this.buildStateChanger("keySignature")}
          valueToString={KeyConverter.keySignatureValueToString}
          label={"Signature"}
        />
      </div>
    );

    return (
      <div className="settings content-box">
        <h3 style={{ marginTop: -5 }}>Settings</h3>
        {deviceSelector}
        <SettingLine className="setting_checkbox" label="Automatic difficulty:">
          <input
            type="checkbox"
            checked={useAutomaticDifficulty}
            id="automatic_difficulty_checkbox"
            name="check"
            onChange={this.buildCheckboxStateChanger("useAutomaticDifficulty")}
          />
          <label htmlFor="automatic_difficulty_checkbox" />
        </SettingLine>
        <SettingLine label="Reset settings">
          <button type="button" onClick={this.resetPitchSettingsToDefault.bind(this)}>
            Reset all to default
          </button>
        </SettingLine>
        {useAutomaticDifficulty ? automaticDifficultySection : manualDifficultySection}
      </div>
    );
    // <SettingLine className="setting_checkbox" label="Accidentals:">
    //   <input
    //    type="checkbox"
    //    checked={this.props.settings.useAccidentals}
    //    id="accidental_checkbox"
    //    name="accidental_checkbox"
    //    onChange={this.buildCheckboxStateChanger("useAccidentals")}
    //   />
    //   <label htmlFor="accidental_checkbox"></label>
    // </SettingLine>
  }
}
