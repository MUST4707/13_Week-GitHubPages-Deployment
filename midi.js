// Class: MIDIengine for MUST 4707
// DO NOT EDIT

/**
 * @fileoverview
 * Minimal MIDI input helper for MUST 4707.
 * Wraps the Web MIDI API to:
 * 1) request access,
 * 2) subscribe to all available inputs (including hot-plugged),
 * 3) parse incoming messages, and
 * 4) dispatch normalized data to user-assignable callbacks.
 *
 * Secure context is required (https or localhost).
 * This class only reads MIDI; it does not send MIDI.
 *
 * @see https://webaudio.github.io/web-midi-api/
 */

/**
 * Called when a Note Off is received.
 * @callback NoteOffHandler
 * @param {number} note - MIDI note number, 0–127.
 * @param {number} velocity - Release velocity, 0–127 (often 0).
 * @param {number} channel - MIDI channel, 0–15.
 * @returns {void}
 */

/**
 * Called when a Note On is received.
 * If velocity is 0, the event is dispatched as Note Off instead.
 * @callback NoteOnHandler
 * @param {number} note - MIDI note number, 0–127.
 * @param {number} velocity - Attack velocity, 1–127.
 * @param {number} channel - MIDI channel, 0–15.
 * @returns {void}
 */

/**
 * Called when Polyphonic Key Pressure (aftertouch per key) is received.
 * @callback PolyKeyPressureHandler
 * @param {number} note - MIDI note number, 0–127.
 * @param {number} pressure - Aftertouch value, 0–127.
 * @param {number} channel - MIDI channel, 0–15.
 * @returns {void}
 */

/**
 * Called when a Control Change is received.
 * @callback ControllerChangeHandler
 * @param {number} controller - Controller number, 0–127.
 * @param {number} value - Controller value, 0–127.
 * @param {number} channel - MIDI channel, 0–15.
 * @returns {void}
 */

/**
 * Called when a Program Change is received.
 * @callback ProgramChangeHandler
 * @param {number} program - Program number, 0–127.
 * @param {number} channel - MIDI channel, 0–15.
 * @returns {void}
 */

/**
 * Called when Channel Pressure (channel aftertouch) is received.
 * @callback ChannelPressureHandler
 * @param {number} pressure - Aftertouch value, 0–127.
 * @param {number} channel - MIDI channel, 0–15.
 * @returns {void}
 */

/**
 * Called when Pitch Bend is received.
 * @callback PitchBendHandler
 * @param {number} bend - Signed bend centered at 0, range -8192..+8191.
 * @param {number} channel - MIDI channel, 0–15.
 * @param {number} raw14 - Raw 14-bit value, 0–16383 (8192 is center).
 * @returns {void}
 */

/**
 * MIDI input engine that normalizes Web MIDI messages into simple callbacks.
 * @class
 * @classdesc
 * Instantiate once, then assign the callbacks you care about:
 * @example
 * const midi = new MIDIengine();
 * midi.onNoteOn = (note, vel, ch) => { /* start a voice *\/ };
 * midi.onNoteOff = (note, vel, ch) => { /* stop a voice *\/ };
 */
export default class MIDIengine {
    constructor() {
        /**
         * User handler for Note Off.
         * @type {NoteOffHandler}
         */
        this.onNoteOff = function () {};

        /**
         * User handler for Note On.
         * @type {NoteOnHandler}
         */
        this.onNoteOn = function () {};

        /**
         * User handler for Polyphonic Key Pressure (per-key aftertouch).
         * @type {PolyKeyPressureHandler}
         */
        this.onPolyKeyPressure = function () {};

        /**
         * User handler for Control Change.
         * @type {ControllerChangeHandler}
         */
        this.onControllerChange = function () {};

        /**
         * User handler for Program Change.
         * @type {ProgramChangeHandler}
         */
        this.onProgramChange = function () {};

        /**
         * User handler for Channel Pressure (channel aftertouch).
         * @type {ChannelPressureHandler}
         */
        this.onChannelPressure = function () {};

        /**
         * User handler for Pitch Bend.
         * @type {PitchBendHandler}
         */
        this.onPitchBend = function () {};

        /**
         * Current Web MIDI access object, or null until granted.
         * @private
         * @type {MIDIAccess|null}
         */
        this._midiAccess = null;

        // Request access (secure context + user permission required)
        navigator.requestMIDIAccess()
            .then(this._onMIDISuccess.bind(this), this._onMIDIFailure.bind(this));
    }

    /**
     * Success callback for requestMIDIAccess.
     * Subscribes to all current inputs and watches for hot-plug changes.
     * @private
     * @param {MIDIAccess} access - Granted Web MIDI access.
     * @returns {void}
     */
    _onMIDISuccess(access) {
        this._midiAccess = access;

        // Hook up all current inputs
        for (const input of access.inputs.values()) {
            /** @type {MIDIInput} */ (input).onmidimessage = this._midiParser.bind(this);
        }
        console.log("success")

        // Hot-plug device changes
        access.onstatechange = (/** @type {MIDIConnectionEvent} */ e) => {
            // e.port: { type: "input"|"output", state: "connected"|"disconnected", name, id, ... }
            if (e.port.type === "input" && e.port.state === "connected") {
                /** @type {MIDIInput} */ (e.port).onmidimessage = this._midiParser.bind(this);
            }
        };
    }

    /**
     * Failure callback for requestMIDIAccess.
     * Logs the error to the console.
     * @private
     * @param {*} err - The error supplied by the Web MIDI API.
     * @returns {void}
     */
    _onMIDIFailure(err) {
        console.error("Failed to access MIDI devices.", err);
    }

    /**
     * Parse a raw MIDI message and dispatch the appropriate callback.
     * Handles running status fields and velocity-zero Note On as Note Off.
     * @private
     * @param {MIDIMessageEvent} event - Incoming Web MIDI message event.
     * @returns {void}
     */
    _midiParser(event) {
        const data = event.data;             // Uint8Array
        const status = data[0];
        const command = status & 0xF0;       // high nibble
        const channel = status & 0x0F;       // 0–15
        const data1 = data[1];               // may be undefined for some messages
        const data2 = data[2];               // may be undefined for some messages

        switch (command) {
            case 0x80: // Note Off
                this.onNoteOff(data1, data2 ?? 0, channel);
                break;

            case 0x90: // Note On (or Note Off if velocity 0)
                if (data2 && data2 > 0) {
                    this.onNoteOn(data1, data2, channel);
                } else {
                    this.onNoteOff(data1, 0, channel);
                }
                break;

            case 0xA0: // Polyphonic Key Pressure
                this.onPolyKeyPressure(data1, data2 ?? 0, channel);
                break;

            case 0xB0: // Control Change
                this.onControllerChange(data1, data2 ?? 0, channel);
                break;

            case 0xC0: // Program Change (1 data byte)
                this.onProgramChange(data1, channel);
                break;

            case 0xD0: // Channel Pressure (1 data byte)
                this.onChannelPressure(data1, channel);
                break;

            case 0xE0: { // Pitch Bend (14-bit: LSB=data1, MSB=data2)
                const value14 = ((data2 ?? 0) << 7) | (data1 ?? 0); // 0..16383
                const bend = value14 - 8192; // center at 0
                // Pass both signed bend and raw 14-bit value
                this.onPitchBend(bend, channel, value14);
                break;
            }

            default:
                // System messages (0xF0..0xFF) and unhandled cases are ignored.
                break;
        }
    }
}
