<script>
    import {onMount} from 'svelte';
    import {
        pitchDetection,
        pitchToNote,
        detuneFromPitch,
        getNoteString,
        getChamberPitch,
        setChamberPitch
    } from './pitchDetector.js';


    export let width = 180;
    export let height = 80;
    export let chamber_pitch = getChamberPitch();
    $: chamber_pitch = setPitch(chamber_pitch);

    function setPitch(pitch) {
        return setChamberPitch(pitch);
    }

    let canvas;

    export function updateCanvas(pitch, note, detune) {
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgb(245,245,235)";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "rgb(166, 166, 166)";
        ctx.font = "12px Arial";
        ctx.fillText(chamber_pitch + ' Hz', 3, 14);
        ctx.fillText(pitch, 3, 26);
        let shift_left_px = (detune < 0) ? 8 : 5;
        ctx.fillText(detune, (width / 2) - shift_left_px, 14);
        ctx.font = "30px Arial";
        ctx.fillText(note, (width / 2) - 10, height - 20);
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo((width / 2), 5);
        ctx.stroke();
        ctx.closePath();
        let color = Math.abs(detune) * 10 > 255 ? 255 : Math.abs(detune) * 10;
        ctx.strokeStyle = "rgb(" + color + ", 0, 0)";
        ctx.beginPath();
        ctx.arc((width / 2), height - 10, 2, 0, 2 * Math.PI);
        ctx.moveTo((width / 2), height - 10);
        ctx.lineTo((width / 2) + detune, (Math.abs(detune) - (Math.abs(Math.round(detune / 3)))) + 10);
        ctx.stroke();
        ctx.closePath();
    }

    export function initCanvas() {
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgb(245,245,245)";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "rgb(6, 6, 6)";
        ctx.font = "12px Arial";
        ctx.fillText("Initializing...", (width / 2) - 30, height / 2);
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo((width / 2), 5);
        ctx.stroke();
        ctx.closePath();
    }

    onMount(async () => {
        initCanvas();
        const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false}).catch(err => {
            console.error(err)
        })
        let AudioContext = window.AudioContext || window.webkitAudioContext || navigator.mozGetUserMedia;
        let aCtx = new AudioContext();
        const analyser = aCtx.createAnalyser();
        analyser.fftSize = 2048;
        const microphone = aCtx.createMediaStreamSource(stream);
        microphone.connect(analyser);
        let fData = new Float32Array(analyser.frequencyBinCount);
        update(analyser, aCtx.sampleRate, fData);
    })

    function update(analyser, sampleRate, fData) {
        const UPDATE_MS = 60;
        let pitch = pitchDetection(fData, sampleRate);
        let note = pitchToNote(pitch);
        let detune = detuneFromPitch(pitch, note);
        analyser.getFloatTimeDomainData(fData);
        updateCanvas(showPitch(pitch), showNote(note), showDetune(detune));
        setTimeout(() => {
            update(analyser, sampleRate, fData);
        }, UPDATE_MS);
    }

    function showDetune(detune) {
        return (isNaN(detune) || (detune > 195 || detune < -195)) ? '' : detune;
    }

    function showNote(note) {
        let noteValue = '';
        if (note) {
            noteValue = getNoteString(note);
        }
        return noteValue;
    }

    function showPitch(pitch) {
        return pitch === -1 ? 'no signal' : Math.round(pitch);
    }
</script>

<canvas bind:this={canvas} width={width} height={height}>
</canvas>
