# Guitar&Bass Tuner / pitch detector
- Web-component: `<guitar-tuner></guitar-tuner>`

[Try out live example](https://ivosdc.github.io/guitar-tuner/dist "Guitar tuner Example")

or include into your website.
```html
<head>
    ...
    <script defer src='https://ivosdc.github.io/guitar-tuner/dist/build/guitar-tuner.js'></script>
</head>
<body>
<guitar-tuner></guitar-tuner>
```html

## Parameter
- width; default: 200
- height; default: 200
- updateCanvas(ctx, device, pitch, note, detune)

default / example:
```html
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
```html


