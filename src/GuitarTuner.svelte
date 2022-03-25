<script>
import {onMount} from 'svelte';
import {pitchDetection, pitchToNote, detuneFromPitch, getNoteString} from './pitchDetector.js';


let pitch = -1;
let note = '';
let device = '';
let detune = 0;
let canvas;

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
        const ctx = canvas.getContext("2d");
        analyser.getFloatTimeDomainData(fData);
        pitch = pitchDetection(fData, aCtx.sampleRate);
        note =  pitchToNote(pitch);
        detune = detuneFromPitch(pitch, note);
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillRect(0, 0, 200, 100);
        ctx.fillStyle = "rgb(0, 0, 0)";
        ctx.font = "9px Arial"
        ctx.fillText(showDevice(device), 1, 99);
        ctx.font = "12px Arial";
        ctx.fillText("Hz: " + showHz(pitch), 5, 15);
        ctx.fillText(showDetune(pitch, note), 90, 15);
        ctx.font = "30px Arial";
        ctx.fillText(showNote(note), 90, 80);
        ctx.beginPath();
        ctx.moveTo(100, 100);
        ctx.lineTo(100 + detune, 0);
        ctx.stroke();
        ctx.closePath();
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
