import React, { Component } from "react";
import PropTypes from "prop-types";

export default class SettingLine extends Component {
  static defaultProps = {
    label: "",
  };

  static propTypes = {
    children: PropTypes.node,
    label: PropTypes.string,
    value: PropTypes.node,
    className: PropTypes.string,
  };

  constructor(props, context) {
    super(props, context);
  }

  render() {
    let className = "settingLine row";
    if (this.props.className) {
      className = [className, this.props.className].join(" ");
    }
    return (
      <div className={className} style={{ marginTop: 4, marginBottom: 4, fontSize: 12 }}>
        <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12" style={{ textAlign: "right", padding:0 }}>
          {this.props.label}
        </div>
        <div
          className="settingValue col-lg-2 col-md-2 col-sm-12 col-xs-12"
          style={{ textAlign: "left" }}
        >
          {this.props.value != null ? this.props.value : null}
        </div>
        <div
          className="settingUI col-lg-5 col-md-5 col-sm-12 col-xs-12"
          style={{ textAlign: "left" }}
        >
          {this.props.children}
        </div>
      </div>
    );
  }
}
