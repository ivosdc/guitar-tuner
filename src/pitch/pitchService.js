let CHAMBER_PITCH = 440;
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A1 = 45;

export function getChamberPitch() {
    return CHAMBER_PITCH;
}

export function setChamberPitch(pitch) {
    if (Number(pitch) ) {
        CHAMBER_PITCH = pitch;
    }
    return getChamberPitch();
}


function noteToFrequency(note) {
    return CHAMBER_PITCH * Math.pow(2, (note - A1) / NOTES.length);
}

export function pitchToNote(frequency) {
	let noteNum = NOTES.length * (Math.log(frequency / CHAMBER_PITCH) / Math.log(2));
	return Math.round(noteNum) + A1;
}

export function detuneFromPitch(frequency, note) {
	return Math.round(NOTES.length * 100 * Math.log(frequency / noteToFrequency(note)) / Math.log(2));
}

export function getNoteString(note) {
    return NOTES[note % NOTES.length]
}
