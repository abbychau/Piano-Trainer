import React, { Component } from "react";
import PropTypes from "prop-types";
import classNames from "classnames";
import _ from "lodash";

import MetronomeService from "../services/metronome_service.js";
import CollapsableContainer from "./collapsable_container.jsx";

export default class MetronomeView extends Component {
  static propTypes = {
    onMetronomeEnded: PropTypes.func,
    settings: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      currentMetronomeBeat: -1,
    };
  }

  getFirstBarBeatTime() {
    return this.firstBarBeatTime;
  }

  playMetronome() {
    const beatLength = this.props.settings.barDuration / 4;
    const delay = 100; // give the scheduler a bit of time to start the jam
    const now = performance.now();
    const startTime = now + delay;
    console.log("startTime", startTime);
    const beatAmount = 8;
    const useSubdivision = !this.props.settings.metronomeUseSubdivisionClick;
    const ticksPerBeat = useSubdivision ? 2 : 1;
    const totalTicks = beatAmount * ticksPerBeat;
    const metronomeSoundLength = 180; // ms
    // Not sure when exactly the metronome beat is anticipated by a human
    // E.g. exactly on the first millisecond? For now I'm assuming at 1/3 of
    // playing time.
    const magicPercentileOfAudibleBeat = 0.33;
    // this is the first beat of the actual bar
    this.firstBarBeatTime =
      startTime + 4 * beatLength + metronomeSoundLength * magicPercentileOfAudibleBeat;

    _.range(totalTicks + 1).map(tickIndex => {
      const tickTime = startTime + tickIndex * (beatLength / ticksPerBeat);
      const delay = tickTime - now;
      const isMainBeat = tickIndex % ticksPerBeat === 0;
      const beatIndex = Math.floor(tickIndex / ticksPerBeat);

      if (tickIndex < totalTicks) {
        MetronomeService.play(delay, !isMainBeat);
      }
      setTimeout(() => {
        this.setState({
          currentMetronomeBeat: isMainBeat && beatIndex < 4 ? beatIndex : -1,
        });

        if (tickIndex === totalTicks) {
          this.props.onMetronomeEnded();
        }
      }, delay);
    });
  }

  render() {
    return (
      <CollapsableContainer
        collapsed={this.state.currentMetronomeBeat === -1}
        className={classNames({
          opacityOut: (this.state.currentMetronomeBeat + 1) % 4 === 0,
        })}
      >
        <h2>{this.state.currentMetronomeBeat + 1}</h2>
      </CollapsableContainer>
    );
  }
}
