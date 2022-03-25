//MIT License, https://github.com/ivosdc/guitar-tuner/tree/main/src/pitchDetector.js

const Hz = 440;

function getMaxPos(c, SIZE) {
    let d = 0;
    while (c[d] > c[d + 1]) {
        d++;
    }

    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    return maxpos;
}

function calcBufferArray(buf) {
    let correlations = new Array(buf.length).fill(0);
    for (let i = 0; i < buf.length; i++) {
        for (let j = 0; j < buf.length - i; j++) {
            correlations[i] = correlations[i] + buf[j] * buf[j + i];
        }
    }

    return correlations;
}

function notEnoughSignal(buf) {
    let signal = 0;
    for (let i = 0; i < buf.length; i++) {
        signal += buf[i] * buf[i];
    }
    signal = Math.sqrt(signal / buf.length);

    return signal < 0.01
}

function getSignalStart(buf, threshold) {
    let start = 0;
    for (let i = 0; i < buf.length / 2; i++) {
        if (Math.abs(buf[i]) < threshold) {
            start = i;
            break;
        }
    }
    return start;
}

function getSignalEnd(buf, threshold) {
    let end = buf.length - 1;
    for (let i = 1; i < buf.length / 2; i++) {
        if (Math.abs(buf[buf.length - i]) < threshold) {
            end = buf.length - i;
            break;
        }
    }
    return end;
}

function getMax(buf) {
    const correlated = calcBufferArray(buf);
    let max = getMaxPos(correlated, buf.length);
    const maxA = (correlated[max - 1] + correlated[max + 1] - 2 * correlated[max]) / 2;
    const maxB = (correlated[max + 1] - correlated[max - 1]) / 2;
    if (maxA >= 0) {
        max = max - maxB / (2 * maxA);
    }
    return max;
}

// ACF2+ algorithm
export function pitchDetection(buf, sampleRate) {
    if (notEnoughSignal(buf)) {
        return -1;
    }
    const threshold = 0.2;    
    buf = buf.slice(getSignalStart(buf, threshold), getSignalEnd(buf, threshold));
	return sampleRate / getMax(buf);
}

export function pitchToNote(frequency) {
	let noteNum = 12 * (Math.log(frequency / Hz) / Math.log(2));
	return Math.round(noteNum) + 69;
}

function noteToFrequency(note) {
	return Hz * Math.pow(2, (note - 69) / 12);
}

export function detuneFromPitch(frequency, note) {
	return Math.abs(Math.floor(1200 * Math.log(frequency / noteToFrequency(note)) / Math.log(2)));
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function getNoteString(note) {
    return NOTES[note%12]
}
