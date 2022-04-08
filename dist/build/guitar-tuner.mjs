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

    // Sourced: https://github.com/peterkhayes/pitchfinder/blob/master/src/detectors/amdf.ts

    const DEFAULT_AMDF_PARAMS = {
        sampleRate: 44100,
        minFrequency: 82,
        maxFrequency: 1000,
        ratio: 5,
        sensitivity: 0.1
    };

    function AMDF(params) {
        const config = {
            ...DEFAULT_AMDF_PARAMS,
            ...params,
        };
        const sampleRate = config.sampleRate;
        const minFrequency = config.minFrequency;
        const maxFrequency = config.maxFrequency;
        const sensitivity = config.sensitivity;
        const ratio = config.ratio;
        const amd = [];

        /* Round in such a way that both exact minPeriod as
         exact maxPeriod lie inside the rounded span minPeriod-maxPeriod,
         thus ensuring that minFrequency and maxFrequency can be found
         even in edge cases */
        const maxPeriod = Math.ceil(sampleRate / minFrequency);
        const minPeriod = Math.floor(sampleRate / maxFrequency);

        return function AMDFDetector(float32AudioBuffer) {
            const maxShift = float32AudioBuffer.length;

            let t = 0;
            let minval = Infinity;
            let maxval = -Infinity;
            let frames1, frames2, calcSub, i, j, u, aux1, aux2;

            // Find the average magnitude difference for each possible period offset.
            for (i = 0; i < maxShift; i++) {
                if (minPeriod <= i && i <= maxPeriod) {
                    for (
                        aux1 = 0, aux2 = i, t = 0, frames1 = [], frames2 = [];
                        aux1 < maxShift - i;
                        t++, aux2++, aux1++
                    ) {
                        frames1[t] = float32AudioBuffer[aux1];
                        frames2[t] = float32AudioBuffer[aux2];
                    }

                    // Take the difference between these frames.
                    const frameLength = frames1.length;
                    calcSub = [];
                    for (u = 0; u < frameLength; u++) {
                        calcSub[u] = frames1[u] - frames2[u];
                    }

                    // Sum the differences.
                    let summation = 0;
                    for (u = 0; u < frameLength; u++) {
                        summation += Math.abs(calcSub[u]);
                    }
                    amd[i] = summation;
                }
            }

            for (j = minPeriod; j < maxPeriod; j++) {
                if (amd[j] < minval) minval = amd[j];
                if (amd[j] > maxval) maxval = amd[j];
            }

            const cutoff = Math.round(sensitivity * (maxval - minval) + minval);
            for (j = minPeriod; j <= maxPeriod && amd[j] > cutoff; j++);

            const searchLength = minPeriod / 2;
            minval = amd[j];
            let minpos = j;
            for (i = j - 1; i < j + searchLength && i <= maxPeriod; i++) {
                if (amd[i] < minval) {
                    minval = amd[i];
                    minpos = i;
                }
            }

            if (Math.round(amd[minpos] * ratio) < maxval) {
                return sampleRate / minpos;
            } else {
                return -1;
            }
        };
    }

    let CHAMBER_PITCH = 440;
    const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const A1 = 45;

    function getChamberPitch() {
        return CHAMBER_PITCH;
    }

    function setChamberPitch(pitch) {
        if (Number(pitch) ) {
            CHAMBER_PITCH = pitch;
        }
        return getChamberPitch();
    }


    function noteToFrequency(note) {
        return CHAMBER_PITCH * Math.pow(2, (note - A1) / NOTES.length);
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
    			/*canvas_1_binding*/ ctx[7](canvas_1);
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
    			/*canvas_1_binding*/ ctx[7](null);
    		}
    	};
    }

    function showDetune(detune) {
    	return isNaN(detune) || (detune > 195 || detune < -195)
    	? ''
    	: detune;
    }

    function showPitch(pitch) {
    	return Math.round(pitch) === -1
    	? 'no signal'
    	: Math.round(pitch);
    }

    function instance($$self, $$props, $$invalidate) {
    	let { width = 180 } = $$props;
    	let { height = 50 } = $$props;
    	let { mute } = $$props;
    	let { chamber_pitch = getChamberPitch() } = $$props;

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
    		ctx.fillStyle = "rgb(166, 166, 166)";
    		ctx.font = "12px Arial";
    		ctx.fillText(chamber_pitch + ' Hz', 3, 14);
    		ctx.fillText(pitch, 3, 26);
    		ctx.font = "28px Arial";
    		ctx.fillText(note, width / 2 - 10, 30);

    		let color = Math.abs(detune) * 10 > 255
    		? 255
    		: Math.abs(detune) * 10;

    		ctx.strokeStyle = "rgb(" + color + ", 0, 0)";
    		ctx.beginPath();
    		ctx.moveTo(width / 2, height - 5);
    		let scale = Math.abs(detune) > 5 ? 2 : 1;
    		ctx.lineTo(width / 2 + detune * scale, height - 5);
    		ctx.lineTo(width / 2 + detune * scale, height - 15);
    		ctx.lineTo(width / 2, height - 15);
    		ctx.lineTo(width / 2, height - 5);
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

    	function maintainCanvas(text, shift_left_px) {
    		clearCanvas();
    		let ctx = canvas.getContext("2d");
    		ctx.fillStyle = "rgb(6, 6, 6)";
    		ctx.font = "12px Arial";
    		ctx.fillText(text, width / 2 - shift_left_px, height / 2);
    		ctx.beginPath();
    		ctx.moveTo(width / 2, 0);
    		ctx.lineTo(width / 2, 5);
    		ctx.stroke();
    		ctx.closePath();
    	}

    	let stream;

    	onMount(async () => {
    		await startMicrophone();
    	});

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

    		stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(err => {
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
    	}

    	function update(analyser, sampleRate, fData) {
    		const UPDATE_MS = 60;

    		const amdf_config = {
    			sampleRate,
    			minFrequency: 50,
    			maxFrequency: 1000,
    			ratio: 10,
    			sensitivity: 0.02
    		};

    		const pitchDetector = AMDF(amdf_config);
    		let pitch = pitchDetector(fData);
    		let note = pitchToNote(pitch);
    		let detune = detuneFromPitch(pitch, note);
    		analyser.getFloatTimeDomainData(fData);

    		if (!mute) {
    			updateCanvas(showPitch(pitch), showNote(note), showDetune(detune));

    			setTimeout(
    				() => {
    					update(analyser, sampleRate, fData);
    				},
    				UPDATE_MS
    			);
    		}
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
    		if ('mute' in $$props) $$invalidate(3, mute = $$props.mute);
    		if ('chamber_pitch' in $$props) $$invalidate(4, chamber_pitch = $$props.chamber_pitch);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*mute*/ 8) {
    			 $$invalidate(3, mute = setMicrophone(mute));
    		}

    		if ($$self.$$.dirty & /*chamber_pitch*/ 16) {
    			 $$invalidate(4, chamber_pitch = setPitch(chamber_pitch));
    		}
    	};

    	return [
    		width,
    		height,
    		canvas,
    		mute,
    		chamber_pitch,
    		updateCanvas,
    		maintainCanvas,
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
    				mute: 3,
    				chamber_pitch: 4,
    				updateCanvas: 5,
    				maintainCanvas: 6
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
    		return ["width", "height", "mute", "chamber_pitch", "updateCanvas", "maintainCanvas"];
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

    	get mute() {
    		return this.$$.ctx[3];
    	}

    	set mute(mute) {
    		this.$$set({ mute });
    		flush();
    	}

    	get chamber_pitch() {
    		return this.$$.ctx[4];
    	}

    	set chamber_pitch(chamber_pitch) {
    		this.$$set({ chamber_pitch });
    		flush();
    	}

    	get updateCanvas() {
    		return this.$$.ctx[5];
    	}

    	get maintainCanvas() {
    		return this.$$.ctx[6];
    	}
    }

    customElements.define("guitar-tuner", GuitarTuner);

    return GuitarTuner;

}());
