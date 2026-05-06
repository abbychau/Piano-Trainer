import React, { Component } from "react";
import PropTypes from "prop-types";
import classNames from "classnames";
import _ from "lodash";

import PitchStatisticView from "../views/pitch_statistic_view.js";
import PitchSettingsView from "../views/pitch_settings_view.js";
import AnalyticsService from "../services/analytics_service.js";
import MidiService from "../services/midi_service.js";
import BarGenerator from "../services/bar_generator.js";
import LevelService from "../services/level_service.js";
import PitchAudioService from "../services/pitch_audio_service.js";
import StaveRenderer from "./stave_renderer.js";
import ClaviatureView from "./claviature_view";
import GameButton from "./game_button.js";
import CollapsableContainer from "./collapsable_container.js";
import MetronomeService from "../services/metronome_service.js";
import KeyConverter from "../services/key_converter.js";

import successMp3Url from "../../resources/success.mp3";
const localStoragePitchComboRewards = "pianoTrainerPitchComboRewards";

export default class PitchReadingView extends Component {
  static propTypes = {
    statisticService: PropTypes.object.isRequired,
    settings: PropTypes.object.isRequired,
    isActive: PropTypes.bool.isRequired,
  };

  static childContextTypes = {
    isInActiveView: PropTypes.bool,
  };

  getChildContext() {
    return {
      isInActiveView: this.props.isActive,
    };
  }

  componentDidMount() {
    this.midiService = new MidiService({
      successCallback: this.onSuccess.bind(this),
      failureCallback: this.onFailure.bind(this),
      errorCallback: this.onMidiError.bind(this),
      errorResolveCallback: this.onMidiErrorResolve.bind(this),
      noteOnCallback: this.onMidiNoteOn.bind(this),
    });
    this.startDate = new Date();
    this.midiService.setDesiredKeys(this.getAllCurrentKeys(), this.state.currentKeySignature);

    const debugMode = true;
    if (debugMode) {
      this.debugKeyUpCallback = event => {
        const yesKeyCode = 89;
        const noKeyCode = 78;
        if (event.keyCode === yesKeyCode) {
          this.onSuccess();
        } else if (event.keyCode === noKeyCode) {
          this.onFailure();
        }
      };
      document.addEventListener("keyup", this.debugKeyUpCallback);
    }
    this.playCurrentReferenceSound();
  }

  componentWillUnmount() {
    document.removeEventListener("keyup", this.debugKeyUpCallback);
    this.stopPitchMetronome();
  }

  componentWillReceiveProps(nextProps) {
    function checkIfSomePropChanged(oldObj, newObj, keys) {
      return keys.some(key => _.at(oldObj, key) !== _.at(newObj, key));
    }

    const nextSettings = nextProps.settings;
    const prevSettings = this.props.settings;

    if (nextSettings !== prevSettings) {
      const nextChordSizeRanges = nextSettings.chordSizeRanges;
      const chordSizeRanges = prevSettings.chordSizeRanges;

      let newCurrentKeys = this.state.currentKeys;
      let keySignature = this.state.currentKeySignature;

      let shouldRegenerateAll = checkIfSomePropChanged(prevSettings, nextSettings, [
        "useAccidentals",
        "useAutomaticDifficulty",
        "automaticDifficulty.newNotesShare",
      ]);

      if (
        shouldRegenerateAll ||
        nextSettings.exerciseLength !== prevSettings.exerciseLength ||
        nextChordSizeRanges.treble !== chordSizeRanges.treble ||
        nextChordSizeRanges.bass !== chordSizeRanges.bass ||
        nextSettings.noteRanges.treble !== prevSettings.noteRanges.treble ||
        nextSettings.noteRanges.bass !== prevSettings.noteRanges.bass
      ) {
        newCurrentKeys = this.generateNewBars(nextSettings);
      }
      if (shouldRegenerateAll || !_.isEqual(prevSettings.keySignature, nextSettings.keySignature)) {
        keySignature = BarGenerator.generateKeySignature(nextSettings);
      }

      this.setState({
        currentChordIndex: 0,
        currentKeys: newCurrentKeys,
        currentKeySignature: keySignature,
      });
      this.startDate = new Date();

      const metronomeSettingChanged =
        nextSettings.useMetronome !== prevSettings.useMetronome ||
        nextSettings.metronomeBeatDuration !== prevSettings.metronomeBeatDuration ||
        nextSettings.metronomeUseSubdivisionClick !== prevSettings.metronomeUseSubdivisionClick;
      if (metronomeSettingChanged && this.state.running) {
        if (nextSettings.useMetronome) {
          this.startPitchMetronome();
        } else {
          this.stopPitchMetronome();
        }
      }
    }
  }

  generateNewBars(settings) {
    const levelIndex = LevelService.getLevelOfUser(this.props.statisticService.getAllEvents()) + 1;
    const level = LevelService.getLevelByIndex(levelIndex);

    const { isMidiAvailable } = this.getMidiInfo();
    const onePerTime = !isMidiAvailable;

    return BarGenerator.generateBars(
      settings,
      settings.useAutomaticDifficulty ? level : null,
      onePerTime,
    );
  }

  generateNewBarState() {
    return {
      currentChordIndex: 0,
      currentKeys: this.generateNewBars(this.props.settings),
      currentKeySignature: BarGenerator.generateKeySignature(this.props.settings),
    };
  }

  constructor(props, context) {
    super(props, context);
    const comboRewards = this.readComboRewards();
    this.state = {
      midiErrorMessage: null,
      running: false,
      comboCount: comboRewards.comboCount,
      coins: comboRewards.coins,
      lastEarnedCoins: 0,
      ...this.generateNewBarState(),
    };
  }

  readComboRewards() {
    const saved = localStorage.getItem(localStoragePitchComboRewards);
    if (!saved) {
      return {
        comboCount: 0,
        coins: 0,
      };
    }
    const parsed = JSON.parse(saved);
    return {
      comboCount: parsed.comboCount || 0,
      coins: parsed.coins || 0,
    };
  }

  saveComboRewards(comboCount, coins) {
    localStorage.setItem(localStoragePitchComboRewards, JSON.stringify({ comboCount, coins }));
  }

  startStopTraining() {
    AnalyticsService.sendEvent("PitchReading", this.state.running ? "Stop" : "Start");
    const nextRunning = !this.state.running;
    this.setState({ running: nextRunning });
    if (nextRunning) {
      this.startPitchMetronome();
      this.playCurrentReferenceSound();
    } else {
      this.stopPitchMetronome();
    }
    this.startDate = new Date();
  }

  resetStats() {
    this.props.statisticService.reset();
    this.setState({
      comboCount: 0,
      lastEarnedCoins: 0,
    });
    this.saveComboRewards(0, this.state.coins);
    this.startDate = new Date();
  }

  startPitchMetronome() {
    if (!this.props.settings.useMetronome) {
      return;
    }
    this.stopPitchMetronome();
    const beatDuration = this.props.settings.metronomeBeatDuration;
    this.lastMetronomeBeatAt = performance.now();
    const useSubdivision = this.props.settings.metronomeUseSubdivisionClick;
    const subdivisionStep = useSubdivision ? beatDuration / 2 : beatDuration;
    this.metronomeTickIndex = 0;
    this.metronomeIntervalId = setInterval(() => {
      const isMainBeat = !useSubdivision || this.metronomeTickIndex % 2 === 0;
      this.lastMetronomeBeatAt = isMainBeat ? performance.now() : this.lastMetronomeBeatAt;
      MetronomeService.play(0, !isMainBeat);
      this.metronomeTickIndex++;
    }, subdivisionStep);
    MetronomeService.play(0, false);
  }

  stopPitchMetronome() {
    if (this.metronomeIntervalId) {
      clearInterval(this.metronomeIntervalId);
      this.metronomeIntervalId = null;
    }
    this.lastMetronomeBeatAt = null;
  }

  getBeatTimingBonus(now) {
    if (!this.props.settings.useMetronome || !this.lastMetronomeBeatAt) {
      return 0;
    }
    const beatDuration = this.props.settings.metronomeBeatDuration;
    const windowMs = this.props.settings.metronomeTimingWindow;
    const timeFromLastBeat = Math.abs(now - this.lastMetronomeBeatAt);
    const distanceToClosestBeat = Math.min(timeFromLastBeat, Math.abs(beatDuration - timeFromLastBeat));
    if (distanceToClosestBeat <= windowMs) {
      return this.props.settings.metronomeBonusCoins;
    }
    return 0;
  }

  isWithinTimingWindow(now) {
    if (!this.props.settings.useMetronome || !this.lastMetronomeBeatAt) {
      return true;
    }
    const beatDuration = this.props.settings.metronomeBeatDuration;
    const windowMs = this.props.settings.metronomeTimingWindow;
    const timeFromLastBeat = Math.abs(now - this.lastMetronomeBeatAt);
    const distanceToClosestBeat = Math.min(timeFromLastBeat, Math.abs(beatDuration - timeFromLastBeat));
    return distanceToClosestBeat <= windowMs;
  }

  getMidiInfo() {
    const tryToUseMidi = this.props.settings.tryToUseMidi;
    const isMidiAvailable = this.props.settings.midi.inputs.get().length > 0;
    const useMidi = tryToUseMidi && isMidiAvailable;
    const noMidiErrors = !this.state ? true : this.state.midiErrorMessage == null;

    return {
      tryToUseMidi,
      isMidiAvailable,
      useMidi,
      noMidiErrors,
    };
  }

  render() {
    const claviatureContainerClasses = classNames({
      "content-box": true,
      "claviature-container": true,
    });

    const { tryToUseMidi, isMidiAvailable, useMidi, noMidiErrors } = this.getMidiInfo();

    const miniClaviature =
      useMidi && noMidiErrors ? null : (
        <ClaviatureView
          desiredKeys={this.getAllCurrentKeys()}
          keySignature={this.state.currentKeySignature}
          successCallback={this.onSuccess.bind(this)}
          failureCallback={this.onFailure.bind(this)}
          notePlayCallback={this.onVirtualKeyPlay.bind(this)}
          disabled={!this.state.running}
        />
      );

    const startStopButton = (
      <GameButton
        label={`${this.state.running ? "Stop" : "Start"} training`}
        shortcutLetter="s"
        primary
        onClick={this.startStopTraining.bind(this)}
      />
    );

    const midiSetUpText = (
      <p>
        {`The generated notes will be so that you play only one note at a time.
      If you want to practice chords, have a look into the `}
        <a href="https://github.com/philippotto/Piano-Trainer#how-to-use">Set Up</a>
        {" section to hook up your digital piano."}
      </p>
    );

    const welcomeText = (
      <CollapsableContainer collapsed={this.state.running}>
        <div
          className={classNames({
            welcomeText: true,
          })}
        >
          <h3>Welcome to pitch training!</h3>
          <p>
            {"When you hit Start, notes will be displayed in the stave above. "}
            {useMidi
              ? "Since we found a connected piano, you can use it to play the notes. "
              : "Just use the mini claviature below to play the notes. "}
            {"Don't worry about the rhythm or speed for now."}
          </p>
          {tryToUseMidi && !isMidiAvailable ? midiSetUpText : null}
        </div>
      </CollapsableContainer>
    );

    const emptyKeySet = {
      treble: [],
      bass: [],
    };

    const hideMidiError = !tryToUseMidi || noMidiErrors;
    const previousAccuracyPercent = Math.round(
      this.props.statisticService.getTimingSuccessRateOfLast(10) * 100,
    );

    return (
      <div className={classNames({ trainer: true, trainerHidden1: !this.props.isActive })}>
        <div className="pitchStatusBar content-box">
          <div className="pitchStatusItem">
            Avg reaction: {" "}
            <strong>{Math.round(this.props.statisticService.getAverageTimeOfLast(50))} ms</strong>
          </div>
          <div className="pitchStatusItem">
            Coins: <strong>{this.state.coins}</strong>
          </div>
          <div className="pitchStatusItem">
            Combo: <strong>{this.state.comboCount}</strong>
          </div>
          <div className="pitchStatusItem">
            Previous accuracy: <strong>{previousAccuracyPercent}%</strong>
          </div>
          <div className="pitchStatusItem">
            Last reward: <strong>+{this.state.lastEarnedCoins}</strong>
          </div>
          <div className="pitchStatusItem">
            <button type="button" onClick={this.resetStats.bind(this)}>
              Reset Stat
            </button>
          </div>
        </div>
        <div className="row center-lg center-md center-sm center-xs">
          <div className="col-lg col-md col-sm col-xs leftColumn">
            <div>
              <div className="game-container content-box">
                <StaveRenderer
                  keys={this.state.running ? this.state.currentKeys : emptyKeySet}
                  chordIndex={this.state.currentChordIndex}
                  keySignature={this.state.currentKeySignature}
                />

                <div
                  className={classNames({
                    "row center-xs": true,
                  })}
                >
                  <div className="col-xs-12">
                    {welcomeText}
                    {startStopButton}
                  </div>
                </div>
              </div>
              <CollapsableContainer collapsed={!miniClaviature && hideMidiError}>
                <div className={claviatureContainerClasses}>
                  {miniClaviature}
                  <div
                    className={classNames({
                      message: true,
                      hide: hideMidiError,
                    })}
                  >
                    <h3>{this.state.midiErrorMessage}</h3>
                  </div>
                </div>
              </CollapsableContainer>
            </div>
          </div>
          <div className="col-lg-4 col-md-12 col-sm-12 col-xs-12 rightColumn">
            <PitchSettingsView settings={this.props.settings} />
            <PitchStatisticView
              statisticService={this.props.statisticService}
              settings={this.props.settings}
            />
          </div>
          <audio
            ref={c => {
              this.successPlayer = c;
            }}
            hidden={true}
            src={successMp3Url}
            controls
            preload="auto"
          />
        </div>
      </div>
    );
  }

  componentDidUpdate() {
    this.midiService.setDesiredKeys(this.getAllCurrentKeys(), this.state.currentKeySignature);
  }

  playCurrentReferenceSound() {
    if (!this.state.running || !this.props.settings.playReferenceSound) {
      return;
    }
    if (this.lastPlayedChordIndex === this.state.currentChordIndex) {
      return;
    }
    const keys = this.getAllCurrentKeys();
    if (keys.length === 0) {
      return;
    }
    this.lastPlayedChordIndex = this.state.currentChordIndex;
    PitchAudioService.playKeys(
      keys,
      this.state.currentKeySignature,
      this.props.settings.referenceSoundVolume,
    );
  }

  onMidiError(msg) {
    console.error.apply(console, arguments);
    this.setState({ midiErrorMessage: msg });
  }

  onMidiErrorResolve() {
    this.setState({ midiErrorMessage: null });
  }

  onMidiNoteOn(keyNumber) {
    if (!this.state.running) {
      return;
    }
    PitchAudioService.playMidiNumbers([keyNumber], this.props.settings.referenceSoundVolume);
  }

  onVirtualKeyPlay(noteName) {
    if (!this.state.running) {
      return;
    }
    const matchingCurrentKey = this.getAllCurrentKeys().find(key => {
      const keyNumber = KeyConverter.getKeyNumberForKeyString(key, this.state.currentKeySignature);
      const soundingKey = KeyConverter.getKeyStringForKeyNumber(keyNumber);
      const soundingNote = KeyConverter.getNoteFromKeyString(soundingKey);
      return soundingNote === noteName;
    });
    const keyToPlay = matchingCurrentKey || `${noteName}/4`;
    PitchAudioService.playKeys([keyToPlay], this.state.currentKeySignature, this.props.settings.referenceSoundVolume);
  }

  getAllCurrentKeys() {
    return _.compact(
      _.flatten(
        ["treble", "bass"].map(clef => {
          const note = this.state.currentKeys[clef][this.state.currentChordIndex];
          // Ignore rests
          return note.noteType !== "r" ? note.getKeys() : null;
        }),
      ),
    );
  }

  onSuccess() {
    if (!this.state.running) {
      return;
    }
    const event = {
      success: true,
      keys: this.getAllCurrentKeys(),
      keySignature: this.state.currentKeySignature,
      time: new Date() - this.startDate,
      timingSuccess: false,
    };
    const successTime = performance.now();
    const timingSuccess = this.isWithinTimingWindow(successTime);
    event.timingSuccess = timingSuccess;
    this.startDate = new Date();

    this.props.statisticService.register(event);
    const nextComboCount = timingSuccess ? this.state.comboCount + 1 : this.state.comboCount;
    const comboBonus = Math.floor(nextComboCount / 5);
    const beatBonus = this.getBeatTimingBonus(successTime);
    const earnedCoins = 1 + comboBonus + beatBonus;
    const nextCoins = this.state.coins + earnedCoins;

    if (this.state.currentChordIndex + 1 >= this.state.currentKeys.treble.length) {
      this.setState({
        comboCount: nextComboCount,
        coins: nextCoins,
        lastEarnedCoins: earnedCoins,
        ...this.generateNewBarState(),
      });
    } else {
      this.setState({
        comboCount: nextComboCount,
        coins: nextCoins,
        lastEarnedCoins: earnedCoins,
        currentChordIndex: this.state.currentChordIndex + 1,
      });
    }
    this.saveComboRewards(nextComboCount, nextCoins);

    // Do not play a separate success jingle here.
    // It is easily perceived as an extra note after key release, especially in MIDI mode.
    AnalyticsService.sendEvent("PitchReading", "success");
  }

  playSuccessSound() {
    const volumePercent = this.props.settings.successSoundVolume;
    const clampedVolume = Math.max(0, Math.min(100, volumePercent || 0)) / 100;
    this.successPlayer.volume = clampedVolume;
    this.successPlayer.play();
  }

  onFailure() {
    if (!this.state.running) {
      return;
    }

    this.props.statisticService.register({
      success: false,
      keys: this.getAllCurrentKeys(),
      time: new Date() - this.startDate,
      keySignature: this.state.currentKeySignature,
    });
    this.setState({
      comboCount: 0,
      lastEarnedCoins: 0,
    });
    this.saveComboRewards(0, this.state.coins);
    AnalyticsService.sendEvent("PitchReading", "failure");
  }
}

