<script>
    import {onMount} from 'svelte';
    import {acf2, getMinSignal, getThreshold, setThreshold, setMinSignal} from './pitch/acf2'
    import {
        pitchToNote,
        detuneFromPitch,
        getNoteString,
        getChamberPitch,
        setChamberPitch
    } from './pitch/pitchService.js';


    export let width = 180;
    export let height = 50;
    export let mute;
    $: mute = setMicrophone(mute);
    export let chamber_pitch = getChamberPitch();
    $: chamber_pitch = setPitch(chamber_pitch);
    export let threshold = getThreshold();
    $: threshold = setThreshold(threshold);
    export let min_signal = getMinSignal();
    $: min_signal = setMinSignal(min_signal);

    function setMicrophone(mute) {
        mute = typeof mute === 'string' ? JSON.parse(mute) : mute;
        if (mute !== undefined) {
            mute ? stopMicrophone() : startMicrophone();
        }
        return mute;
    }

    function setPitch(pitch) {
        return setChamberPitch(pitch);
    }

    let canvas;

    function updateCanvas(pitch, note, detune) {
        clearCanvas();
        let ctx = canvas.getContext("2d");
        drawCanvas(ctx, pitch, note, detune)
    }

    export function drawCanvas(ctx, pitch, note, detune) {
        ctx.fillStyle = "rgb(166, 166, 166)";
        ctx.font = "12px Arial";
        ctx.fillText(chamber_pitch + ' Hz', 3, 14);
        ctx.fillText(pitch, 3, 26);
        ctx.font = "28px Arial";
        ctx.fillText(note, (width / 2) - 10, 30);
        let color = Math.abs(detune) * 10 > 255 ? 255 : Math.abs(detune) * 10;
        ctx.strokeStyle = "rgb(" + color + ", 0, 0)";
        ctx.beginPath();
        ctx.moveTo((width / 2), height - 5);
        let scale = Math.abs(detune) > 5 ? 2 : 1;
        ctx.lineTo((width / 2) + detune * scale, height - 5);
        ctx.lineTo((width / 2) + detune * scale, height - 15);
        ctx.lineTo((width / 2), height - 15);
        ctx.lineTo((width / 2), height - 5);
        ctx.stroke();
        ctx.closePath();
        ctx.fillStyle = "rgb(" + color + ", 0, 0)";
        ctx.fill();
    }

    function clearCanvas() {
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgb(245,245,235)";
        ctx.fillRect(0, 0, width, height);
    }

    export function maintainCanvas(text, shift_left_px) {
        clearCanvas();
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgb(6, 6, 6)";
        ctx.font = "12px Arial";
        ctx.fillText(text, (width / 2) - shift_left_px, height / 2);
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo((width / 2), 5);
        ctx.stroke();
        ctx.closePath();
    }

    let stream;

    onMount(async () => {
        await startMicrophone();
    })

    function stopMicrophone() {
        maintainCanvas("Microphone off", 40);
        stream.getTracks().forEach(function (track) {
            if (track.readyState === 'live' && track.kind === 'audio') {
                track.stop();
            }
        });
    }

    async function startMicrophone() {
        maintainCanvas("Initializing...", 30);
        stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false}).catch(err => {
            console.error(err)
        })
        let AudioContext = window.AudioContext || window.webkitAudioContext || navigator.mozGetUserMedia;
        let aCtx = new AudioContext();
        const analyser = aCtx.createAnalyser();
        analyser.fftSize = 4096;
        const microphone = aCtx.createMediaStreamSource(stream);
        microphone.connect(analyser);
        let fData = new Float32Array(analyser.frequencyBinCount);
        update(analyser, aCtx.sampleRate, fData);
    }

    function update(analyser, sampleRate, fData) {
        const UPDATE_MS = 60;
        let pitch = acf2(fData, sampleRate);
        let note = pitchToNote(pitch);
        let detune = detuneFromPitch(pitch, note);
        analyser.getFloatTimeDomainData(fData);
        if (!mute) {
            updateCanvas(showPitch(pitch), showNote(note), showDetune(detune));
            setTimeout(() => {
                update(analyser, sampleRate, fData);
            }, UPDATE_MS);
        }
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
        return Math.round(pitch) === -1 ? 'no signal' : Math.round(pitch);
    }
</script>

<canvas bind:this={canvas} width={width} height={height}>
</canvas>
