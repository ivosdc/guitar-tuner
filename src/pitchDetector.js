//MIT License, https://github.com/ivosdc/guitar-tuner/tree/main/src/pitchDetector.js

const Hz = 440;
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A3 = 69;
const MIN_SIGNAL = 0.002;
const THRESHOLD = 0.002;

function getMaxPos(correlated, SIZE) {
    let max = 0;
    while (correlated[max] > correlated[max + 1]) {
        max++;
    }

    let maxval = -1;
    let maxpos = -1;
    for (let i = max; i < SIZE; i++) {
        if (correlated[i] > maxval) {
            maxval = correlated[i];
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

    return signal < MIN_SIGNAL
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

function noteToFrequency(note) {
	return Hz * Math.pow(2, (note - A3) / NOTES.length);
}

// ACF2+ algorithm
export function pitchDetection(buf, sampleRate) {
    if (notEnoughSignal(buf)) {
        return -1;
    }
    buf = buf.slice(getSignalStart(buf, THRESHOLD), getSignalEnd(buf, THRESHOLD));
	return sampleRate / getMax(buf);
}

export function pitchToNote(frequency) {
	let noteNum = NOTES.length * (Math.log(frequency / Hz) / Math.log(2));
	return Math.round(noteNum) + A3;
}

export function detuneFromPitch(frequency, note) {
	return Math.floor(1200 * Math.log(frequency / noteToFrequency(note)) / Math.log(2));
}

export function getNoteString(note) {
    return NOTES[note%12]
}
