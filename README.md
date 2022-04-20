
# Guitar-Tuner / pitch detector
- Web-component: `<guitar-tuner></guitar-tuner>`
#### ...made with Svelte

[Try out live example](https://ivosdc.github.io/guitar-tuner/dist "Guitar tuner Example")

or include into your website.
```html
<head>
...
    <script defer src='https://ivosdc.github.io/guitar-tuner/dist/build/guitar-tuner.js'></script>
</head>
<body>
...
<guitar-tuner></guitar-tuner>
...
```

## Parameter
- chamber_pitch; default: 440
- width; default: 180
- height; default: 80
- mute; default: false
- min_signal; Signal strength of the microphone.
- threshold; Threshold for pitch detection.
- drawCanvas(ctx, pitch, note, detune)

example / default:
```js
function drawCanvas(ctx, pitch, note, detune) {
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
```

JS-Example using Parameter.
```html
<head>
    ...
    <script defer src='https://ivosdc.github.io/guitar-tuner/dist/build/guitar-tuner.js'></script>
</head>
<body>
<div>
    <span id="pitch-down" class="pitch-tune"><-</span>
    <span class="pitch-tune">pitch</span>
    <span id="pitch-up" class="pitch-tune">+></span>
    <span id="mute" class="pitch-tune">  mic[on/off]</span>
</div>
<guitar-tuner id="guitar-tuner" />

<script>
    let pitch = 440;
    let guitarTuner = document.getElementById('guitar-tuner');
    guitarTuner.setAttribute('shadowed', 'true');

    let pitchUp = document.getElementById('pitch-up');
    pitchUp.onclick = setPitchUp;
    let pitchDown = document.getElementById('pitch-down');
    pitchDown.onclick = setPitchDown;
    let mute = document.getElementById('mute');
    mute.onclick = toggleMute;

    let muted = false;
    function toggleMute() {
        muted = !muted;
        guitarTuner.setAttribute('mute', muted.toString());
    }

    function setPitchUp() {
        pitch++;
        guitarTuner.setAttribute('chamber_pitch', pitch.toString());
    }

    function setPitchDown() {
        pitch--;
        guitarTuner.setAttribute('chamber_pitch', pitch.toString());
    }
</script>
```