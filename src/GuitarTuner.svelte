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
    ctx.font = "18px Arial";
    if (detune < 0) {
        ctx.fillText(detune, (width / 2) - 10, 28);
    } else {
        ctx.fillText(detune, (width / 2) - 6, 28);
    }
    ctx.font = "30px Arial";
    ctx.fillText(note, (width / 2) - 11, height - 20);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo((width / 2), 5);
    ctx.stroke();
    ctx.closePath();
    if (Math.abs(detune) > 10) {
        ctx.fillStyle = "rgb(255, 0, 0)";
    }
    ctx.beginPath();
    ctx.moveTo((width / 2), height - 20);
    ctx.lineTo((width / 2) + (detune * 2), (Math.abs(detune) - (Math.abs(detune / 3))));
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

const AVERAGE_COUNT = 10;
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
    let detune_current = 0;
    let detune_average = 0;
    let counter = 0;
    (function update() {
        analyser.getFloatTimeDomainData(fData);
        pitch = pitchDetection(fData, aCtx.sampleRate);
        detune = detuneFromPitch(pitch, note);
        note =  pitchToNote(pitch);
        detune_average += detune;
        counter++;
        if (counter % AVERAGE_COUNT === 0) {
            detune_current = Math.round(detune_average % 10);
            detune_average = 0;
            counter = 0;
        }
        updateCanvas(ctx, showDevice(device), showHz(pitch), showNote(note), showDetune(detune_current));
        requestAnimationFrame(update);
    }());

})

function showDetune(detune) {
    return isNaN(detune) ? 0 : detune;
}

function showNote(note) {
    let notevalue = '--';
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
