var GuitarTuner = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function attribute_to_object(attributes) {
        const result = {};
        for (const attribute of attributes) {
            result[attribute.name] = attribute.value;
        }
        return result;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement === 'function') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                const { on_mount } = this.$$;
                this.$$.on_disconnect = on_mount.map(run).filter(is_function);
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            disconnectedCallback() {
                run_all(this.$$.on_disconnect);
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set($$props) {
                if (this.$$set && !is_empty($$props)) {
                    this.$$.skip_bound = true;
                    this.$$set($$props);
                    this.$$.skip_bound = false;
                }
            }
        };
    }

    //MIT License, https://github.com/ivosdc/guitar-tuner/tree/main/src/pitchDetector.js

    let CHAMBER_PITCH = 440;
    const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const A1 = 33;
    const THRESHOLD = 0.0025;

    function getChamberPitch() {
        return CHAMBER_PITCH;
    }

    function setChamberPitch(pitch) {
        if (Number(pitch) ) {
            CHAMBER_PITCH = pitch;
        }
        return getChamberPitch();
    }

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

        return signal < THRESHOLD
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
    	return CHAMBER_PITCH * Math.pow(2, (note - A1) / NOTES.length);
    }

    // ACF2+ algorithm
    function pitchDetection(buf, sampleRate) {
        if (notEnoughSignal(buf)) {
            return -1;
        }
        buf = buf.slice(getSignalStart(buf, THRESHOLD), getSignalEnd(buf, THRESHOLD));
    	return sampleRate / getMax(buf);
    }

    function pitchToNote(frequency) {
    	let noteNum = NOTES.length * (Math.log(frequency / CHAMBER_PITCH) / Math.log(2));
    	return Math.round(noteNum) + A1;
    }

    function detuneFromPitch(frequency, note) {
    	return Math.round(NOTES.length * 100 * Math.log(frequency / noteToFrequency(note)) / Math.log(2));
    }

    function getNoteString(note) {
        return NOTES[note % NOTES.length]
    }

    /* src/GuitarTuner.svelte generated by Svelte v3.46.4 */

    function create_fragment(ctx) {
    	let canvas_1;

    	return {
    		c() {
    			canvas_1 = element("canvas");
    			this.c = noop;
    			attr(canvas_1, "width", /*width*/ ctx[0]);
    			attr(canvas_1, "height", /*height*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert(target, canvas_1, anchor);
    			/*canvas_1_binding*/ ctx[6](canvas_1);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*width*/ 1) {
    				attr(canvas_1, "width", /*width*/ ctx[0]);
    			}

    			if (dirty & /*height*/ 2) {
    				attr(canvas_1, "height", /*height*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(canvas_1);
    			/*canvas_1_binding*/ ctx[6](null);
    		}
    	};
    }

    function showDetune(detune) {
    	return isNaN(detune) || (detune > 195 || detune < -195)
    	? ''
    	: detune;
    }

    function showPitch(pitch) {
    	return pitch === -1 ? 'no signal' : Math.round(pitch);
    }

    function instance($$self, $$props, $$invalidate) {
    	let { width = 180 } = $$props;
    	let { height = 80 } = $$props;
    	let { chamber_pitch = getChamberPitch() } = $$props;

    	function setPitch(pitch) {
    		return setChamberPitch(pitch);
    	}

    	let canvas;

    	function updateCanvas(pitch, note, detune) {
    		let ctx = canvas.getContext("2d");
    		ctx.fillStyle = "rgb(245,245,235)";
    		ctx.fillRect(0, 0, width, height);
    		ctx.fillStyle = "rgb(166, 166, 166)";
    		ctx.font = "12px Arial";
    		ctx.fillText(chamber_pitch + ' Hz', 3, 14);
    		ctx.fillText(pitch, 3, 26);
    		let shift_left_px = detune < 0 ? 8 : 5;
    		ctx.fillText(detune, width / 2 - shift_left_px, 14);
    		ctx.font = "30px Arial";
    		ctx.fillText(note, width / 2 - 10, height - 20);
    		ctx.beginPath();
    		ctx.moveTo(width / 2, 0);
    		ctx.lineTo(width / 2, 5);
    		ctx.stroke();
    		ctx.closePath();

    		let color = Math.abs(detune) * 10 > 255
    		? 255
    		: Math.abs(detune) * 10;

    		ctx.strokeStyle = "rgb(" + color + ", 0, 0)";
    		ctx.beginPath();
    		ctx.arc(width / 2, height - 10, 2, 0, 2 * Math.PI);
    		ctx.moveTo(width / 2, height - 10);
    		ctx.lineTo(width / 2 + detune, Math.abs(detune) - Math.abs(Math.round(detune / 3)) + 10);
    		ctx.stroke();
    		ctx.closePath();
    	}

    	function initCanvas() {
    		let ctx = canvas.getContext("2d");
    		ctx.fillStyle = "rgb(245,245,245)";
    		ctx.fillRect(0, 0, width, height);
    		ctx.fillStyle = "rgb(6, 6, 6)";
    		ctx.font = "12px Arial";
    		ctx.fillText("Initializing...", width / 2 - 30, height / 2);
    		ctx.beginPath();
    		ctx.moveTo(width / 2, 0);
    		ctx.lineTo(width / 2, 5);
    		ctx.stroke();
    		ctx.closePath();
    	}

    	onMount(async () => {
    		initCanvas();

    		const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(err => {
    			console.error(err);
    		});

    		let AudioContext = window.AudioContext || window.webkitAudioContext || navigator.mozGetUserMedia;
    		let aCtx = new AudioContext();
    		const analyser = aCtx.createAnalyser();
    		analyser.fftSize = 2048;
    		const microphone = aCtx.createMediaStreamSource(stream);
    		microphone.connect(analyser);
    		let fData = new Float32Array(analyser.frequencyBinCount);
    		update(analyser, aCtx.sampleRate, fData);
    	});

    	function update(analyser, sampleRate, fData) {
    		const UPDATE_MS = 60;
    		let pitch = pitchDetection(fData, sampleRate);
    		let note = pitchToNote(pitch);
    		let detune = detuneFromPitch(pitch, note);
    		analyser.getFloatTimeDomainData(fData);
    		updateCanvas(showPitch(pitch), showNote(note), showDetune(detune));

    		setTimeout(
    			() => {
    				update(analyser, sampleRate, fData);
    			},
    			UPDATE_MS
    		);
    	}

    	function showNote(note) {
    		let noteValue = '';

    		if (note) {
    			noteValue = getNoteString(note);
    		}

    		return noteValue;
    	}

    	function canvas_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			canvas = $$value;
    			$$invalidate(2, canvas);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('chamber_pitch' in $$props) $$invalidate(3, chamber_pitch = $$props.chamber_pitch);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*chamber_pitch*/ 8) {
    			 $$invalidate(3, chamber_pitch = setPitch(chamber_pitch));
    		}
    	};

    	return [
    		width,
    		height,
    		canvas,
    		chamber_pitch,
    		updateCanvas,
    		initCanvas,
    		canvas_1_binding
    	];
    }

    class GuitarTuner extends SvelteElement {
    	constructor(options) {
    		super();

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				width: 0,
    				height: 1,
    				chamber_pitch: 3,
    				updateCanvas: 4,
    				initCanvas: 5
    			},
    			null
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return ["width", "height", "chamber_pitch", "updateCanvas", "initCanvas"];
    	}

    	get width() {
    		return this.$$.ctx[0];
    	}

    	set width(width) {
    		this.$$set({ width });
    		flush();
    	}

    	get height() {
    		return this.$$.ctx[1];
    	}

    	set height(height) {
    		this.$$set({ height });
    		flush();
    	}

    	get chamber_pitch() {
    		return this.$$.ctx[3];
    	}

    	set chamber_pitch(chamber_pitch) {
    		this.$$set({ chamber_pitch });
    		flush();
    	}

    	get updateCanvas() {
    		return this.$$.ctx[4];
    	}

    	get initCanvas() {
    		return this.$$.ctx[5];
    	}
    }

    customElements.define("guitar-tuner", GuitarTuner);

    return GuitarTuner;

}());
