let MIN_SIGNAL = 0.01;
let THRESHOLD = 0.00865;

export function setMinSignal(signal) {
    MIN_SIGNAL = signal;
    return MIN_SIGNAL;
}

export function setThreshold(threshold) {
    THRESHOLD = threshold;
    return THRESHOLD;
}

export function getMinSignal() {
    return MIN_SIGNAL;
}

export function getThreshold() {
    return THRESHOLD;
}


function getMaxPos(correlated, SIZE) {
    let max = 0;
    while (correlated[max] > correlated[max + 1]) {
        max++;
    }

    let maxValue = -1;
    let maxPos = -1;
    for (let i = max; i < SIZE; i++) {
        if (correlated[i] > maxValue) {
            maxValue = correlated[i];
            maxPos = i;
        }
    }
    return maxPos;
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

function isEnoughSignal(buf) {
    let signal = 0;
    for (let i = 0; i < buf.length; i++) {
        signal += buf[i] * buf[i];
    }
    signal = Math.sqrt(signal / buf.length);

    return signal > MIN_SIGNAL;
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
export function acf2(buf, sampleRate) {
    buf = buf.slice(getSignalStart(buf, THRESHOLD), getSignalEnd(buf, THRESHOLD));
    if(isEnoughSignal(buf))
    {
        return sampleRate / getMax(buf);
    }
    return -1;
}
