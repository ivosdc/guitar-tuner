<script>
import {onMount} from 'svelte';
import {pitchDetection, pitchToNote, detuneFromPitch, getNoteString} from './pitchDetector.js';


let pitch = -1;
let note = '';
let device = '';

onMount(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true}).catch(err => {
        console.error(err)
    })
    let audioTracks = stream.getAudioTracks();
    device = audioTracks[0].label;
    let AudioContext = window.AudioContext || window.webkitAudioContext || navigator.mozGetUserMedia;
    let aCtx = new AudioContext();
    const analyser = aCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.connect(aCtx.destination);
    const microphone = aCtx.createMediaStreamSource(stream);
    microphone.connect(analyser);
    let fData = new Float32Array(analyser.frequencyBinCount);

    (function updateCanvas() {
        analyser.getFloatTimeDomainData(fData);
        pitch = pitchDetection(fData, aCtx.sampleRate);
        note =  pitchToNote(pitch);
        requestAnimationFrame(updateCanvas);
    }());
})

function showNote(note) {
    let notevalue = '';
    if (note) {
        notevalue = getNoteString(note);
    }
    return notevalue;
}

function showDetune(pitch, note) {
    let detune = '';
    if (note) {
        detune = " detune: " + detuneFromPitch(pitch, note);
    }
    return detune;
}

function showHz(pitch) {
    return pitch === -1 ? 'no signal' : Math.round(pitch);
}

</script>


<main>
    <p id="device">Using device: {device}</p>
    <p id="pitch">Hz: {showHz(pitch)}</p>
    <span id="note">{showNote(note)}</span>
    <span id="detune">{showDetune(pitch, note)}</span>
</main>

<style>
    #note {
        font-size: 3em;
    }
    #detune {
        font-size: 1.5em;
    }
</style>