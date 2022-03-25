<script>
import {onMount} from 'svelte';
import {pitchDetection, pitchToNote, detuneFromPitch, getNoteString} from './pitchDetector.js';


let pitch = -1;
let note = '';
let device = '';
let detune = 0;
let canvas;
let ctx;
export let width = 200;
export let height = 100;

export function updateCanvas(ctx, device, pitch, note, detune) {
    ctx.fillStyle = "rgb(245,245,245)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.font = "9px Arial"
    ctx.fillText(showDevice(device), 1, height - 1);
    ctx.font = "12px Arial";
    ctx.fillText("Hz: " + showHz(pitch), 5, 15);
    ctx.fillText(showDetune(pitch, note), (width / 2) - 10, 15);
    ctx.font = "30px Arial";
    ctx.fillText(showNote(note), (width / 2) - 10, height - 20);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo((width / 2), 5);
    ctx.stroke();
    ctx.closePath();
    ctx.beginPath();
    ctx.moveTo(width / 2, height);
    ctx.lineTo((width / 2) + detune, 0);
    ctx.stroke();
    ctx.closePath();
}

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
    const microphone = aCtx.createMediaStreamSource(stream);
    microphone.connect(analyser);
    let fData = new Float32Array(analyser.frequencyBinCount);
    ctx = canvas.getContext("2d");
        
    (function update() {
        analyser.getFloatTimeDomainData(fData);
        pitch = pitchDetection(fData, aCtx.sampleRate);
        note =  pitchToNote(pitch);
        detune = detuneFromPitch(pitch, note);
        updateCanvas(ctx, device, pitch, note, detune);
        requestAnimationFrame(update);
    }());

})



function showNote(note) {
    let notevalue = '#';
    if (note) {
        notevalue = getNoteString(note);
    }
    return notevalue;
}

function showDetune(pitch, note) {
    let detune = '';
    if (note) {
        detune = detuneFromPitch(pitch, note);
    }
    return detune;
}

function showHz(pitch) {
    return pitch === -1 ? 'no signal' : Math.round(pitch);
}

function showDevice(device) {
    let offset = device.lastIndexOf("(");
    return device.substr(0, offset - 1);
}

</script>

<canvas bind:this={canvas} width="200" height="100" style="border:1px solid #000000;">
</canvas>
