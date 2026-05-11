import successMp3Url from "../../resources/success.mp3";
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffer;
let accentBuffer;

function loadMp3(url, onLoad) {
  const request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  request.onload = function() {
    const audioData = request.response;

    audioCtx.decodeAudioData(
      audioData,
      function(buffer) {
        onLoad(buffer);
      },
      function(e) {
        console.error("Error with decoding audio data" + e.err);
      },
    );
  };

  request.send();
}

loadMp3(successMp3Url, buffer => {
  audioBuffer = buffer;
});
loadMp3(successMp3Url, buffer => {
  accentBuffer = buffer;
});

export default {
  createAudioNode: function(accent) {
    const source = audioCtx.createBufferSource();
    source.buffer = accent ? accentBuffer || audioBuffer : audioBuffer;
    source.playbackRate.value = accent ? 1.22 : 1.0;
    const gain = audioCtx.createGain();
    gain.gain.value = accent ? 0.55 : 0.9;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    return source;
  },
  play: function(delay, accent) {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const source = this.createAudioNode(accent);
    source.start(audioCtx.currentTime + delay / 1000);
    return source;
  },
  stop: function(source) {
    source.stop(0);
  },
};
