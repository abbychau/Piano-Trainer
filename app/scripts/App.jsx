import React, { Component } from "react";
import PitchReadingView from "./views/pitch_reading_view";
import RhythmReadingView from "./views/rhythm_reading_view";
import RecorderView from "./views/recorder_view";
import PitchStatisticService from "./services/pitch_statistic_service.js";
import RhythmStatisticService from "./services/rhythm_statistic_service.js";
import AnalyticsService from "./services/analytics_service.js";
import AppFreezer from "./AppFreezer.js";
import { Nav, NavItem } from "react-bootstrap";

import pianoBackgroundJpg from "../images/piano-background.jpg";

// Get the base path of the application (supports deployment in subfolders)
function getBasePath() {
  // import.meta.env.BASE_URL is provided by Vite and always ends with '/'
  const base = import.meta.env.BASE_URL || "/";
  // Remove trailing slash for path construction
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export default class App extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      activeGame: this.getGameFromPath(window.location.pathname),
    };
    this.onPopState = this.onPopState.bind(this);
    this.onAppUpdate = this.onAppUpdate.bind(this);
  }

  getGameFromPath(pathname) {
    const base = getBasePath();
    // Strip the base path from the pathname to get the relative path
    const path = base ? pathname.replace(base, "") || "/" : pathname;
    if (path === "/rhythm") {
      return "rhythm";
    }
    if (path === "/recorder") {
      return "recorder";
    }
    return "pitch";
  }

  getPathFromGame(game) {
    const base = getBasePath();
    if (game === "rhythm") {
      return base + "/rhythm";
    }
    if (game === "recorder") {
      return base + "/recorder";
    }
    return base + "/pitch";
  }

  selectGame(newGame, shouldPushHistory = true) {
    if (!newGame || newGame === this.state.activeGame) {
      return;
    }
    this.setState({
      activeGame: newGame,
    });
    if (shouldPushHistory) {
      const nextPath = this.getPathFromGame(newGame);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({ game: newGame }, "", nextPath);
      }
    }

    AnalyticsService.sendEvent("GameSelection", newGame);
  }

  onPopState() {
    const gameFromUrl = this.getGameFromPath(window.location.pathname);
    this.selectGame(gameFromUrl, false);
  }

  onAppUpdate() {
    this.forceUpdate();
  }

  render() {
    const appState = AppFreezer.get();
    let activeView = null;
    if (this.state.activeGame === "pitch") {
      activeView = (
        <PitchReadingView
          statisticService={PitchStatisticService}
          settings={appState.settings.pitchReading}
          key="pitch_game"
          isActive={true}
        />
      );
    } else if (this.state.activeGame === "rhythm") {
      activeView = (
        <RhythmReadingView
          statisticService={RhythmStatisticService}
          settings={appState.settings.rhythmReading}
          key="rhythm_game"
          isActive={true}
        />
      );
    } else {
      activeView = (
        <RecorderView key="recorder_game" isActive={true} settings={appState.settings.pitchReading} />
      );
    }

    return (
      <div className="site">
        <div className="site-content">
          <img id="image-background" src={pianoBackgroundJpg} />

          <div className="jumbotron">
            <div className="row center-xs">
              <div className="col-xs">
                <Nav
                  bsStyle="pills"
                  activeKey={this.state.activeGame}
                  onSelect={this.selectGame.bind(this)}
                  className="inlineBlock"
                >
                  <NavItem eventKey="pitch" className="modeNavItem">
                    Pitch training
                  </NavItem>
                  <NavItem eventKey="rhythm" className="modeNavItem">
                    Rhythm training
                  </NavItem>
                  <NavItem eventKey="recorder" className="modeNavItem">
                    Recorder
                  </NavItem>
                </Nav>
              </div>
            </div>
          </div>

          <div className="gameContainer">{activeView}</div>
        </div>
      </div>
    );
  }

  componentDidMount() {
    const initialPath = this.getPathFromGame(this.state.activeGame);
    if (window.location.pathname !== initialPath) {
      window.history.replaceState({ game: this.state.activeGame }, "", initialPath);
    }
    window.addEventListener("popstate", this.onPopState);
    AppFreezer.on("update", this.onAppUpdate);
  }

  componentWillUnmount() {
    window.removeEventListener("popstate", this.onPopState);
    AppFreezer.off("update", this.onAppUpdate);
  }
}
