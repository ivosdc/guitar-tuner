<script>
import {onMount} from 'svelte';
import {pitchDetection, noteFromPitch, detuneFromPitch, noteStrings} from './pitchDetector.js';

let pitch = -1;
let note = '';
let detune = 0;
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
        note =  noteFromPitch(pitch);
        detune = detuneFromPitch(pitch, note);
        requestAnimationFrame(updateCanvas);
    }());
})
</script>


<main>
    <p id="device">Using device: {device}</p>
    <p id="pitch">Hz: {Math.round(pitch)}</p>
    <p id="note">Note: {noteStrings[note%12]}</p>
    <p id="detune">Detune: {Math.abs(detune)}</p>
</main>

<style>
</style>