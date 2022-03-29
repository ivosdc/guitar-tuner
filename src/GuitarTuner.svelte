<script>
import {onMount} from 'svelte';
import {pitchDetection, pitchToNote, detuneFromPitch, getNoteString} from './pitchDetector.js';


export let width = 300;
export let height = 150;

export function updateCanvas(ctx, device, pitch, note, detune) {
    ctx.fillStyle = "rgb(245,245,245)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.font = "9px Arial"
    ctx.fillText(device, 1, height - 1);
    ctx.font = "12px Arial";
    ctx.fillText(pitch, 3, 14);
    ctx.font = "12px Arial";
    if (detune < 0) {
        ctx.fillText(detune, (width / 2) - 8, height - 30);
    } else {
        ctx.fillText(detune, (width / 2) - 5, height - 30);
    }
    ctx.font = "50px Arial";
    ctx.fillText(note, (width / 2) - 15, height / 3 * 2);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo((width / 2), 5);
    ctx.stroke();
    ctx.closePath();
    let color = Math.abs(detune) * 10 > 255 ? 255 : Math.abs(detune) * 10;
    ctx.strokeStyle = "rgb(" + color + ", 0, 0)";
    ctx.beginPath();
    ctx.arc((width / 2), height - 20, 2, 0, 2 * Math.PI);
    ctx.moveTo((width / 2), height - 20);
    ctx.lineTo((width / 2) + (detune * 2), (Math.abs(detune) - (Math.abs(Math.round(detune / 3)))) + 10);
    ctx.stroke();
    ctx.closePath();
}

export function startScreenCanvas(ctx) {
    ctx.fillStyle = "rgb(245,245,245)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgb(6, 6, 6)";
    ctx.font = "18px Arial";
    ctx.fillText("init app ...", (width / 2) - 45, height / 2);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo((width / 2), 5);
    ctx.stroke();
    ctx.closePath();
}

let canvas;
let ctx;

onMount(async () => {
    ctx = canvas.getContext("2d");
    startScreenCanvas(ctx);
    const stream = await navigator.mediaDevices.getUserMedia({audio: true}).catch(err => {
        console.error(err)
    })
    let audioTracks = stream.getAudioTracks();
    let device = audioTracks[0].label;;
    let AudioContext = window.AudioContext || window.webkitAudioContext || navigator.mozGetUserMedia;
    let aCtx = new AudioContext();
    const analyser = aCtx.createAnalyser();
    analyser.fftSize = 2048;
    const microphone = aCtx.createMediaStreamSource(stream);
    microphone.connect(analyser);
    let fData = new Float32Array(analyser.frequencyBinCount);
    let pitch = -1;
    let note = '';
    let detune = 0;
    let last_detune = 0;
    (function update() {
        analyser.getFloatTimeDomainData(fData);
        pitch = pitchDetection(fData, aCtx.sampleRate);
        last_detune = detune;
        detune = detuneFromPitch(pitch, note);
        detune = Math.abs(last_detune - detune) > 10 ? last_detune : detune;
        note =  pitchToNote(pitch);
        updateCanvas(ctx, showDevice(device), showHz(pitch), showNote(note), showDetune(detune));
        setTimeout(() => {  update(); }, 100);
    }());
})

function showDetune(detune) {
    return (isNaN(detune) || (detune > 195 || detune < -195)) ? '' : detune;
}

function showNote(note) {
    let notevalue = '';
    if (note) {
        notevalue = getNoteString(note);
    }
    return notevalue;
}

function showHz(pitch) {
    return pitch === -1 ? 'no signal' : "Hz: " +  Math.round(pitch);
}

function showDevice(device) {
    let offset = device.lastIndexOf("(");
    return device.substr(0, offset - 1);
}
</script>

<canvas bind:this={canvas} width={width} height={height} style="border:1px solid #000000;">
</canvas>
