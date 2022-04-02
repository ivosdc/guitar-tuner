# Guitar&Bass Tuner / pitch detector
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
- updateCanvas(ctx, device, pitch, note, detune)

example / default:
```js
let canvas;
function updateCanvas(pitch, note, detune) {
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
```

'canvas' is bound to the canvas-element inside app-context. Must be used to create the 2D-context.


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