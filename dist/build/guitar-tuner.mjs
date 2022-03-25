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
    function append(target, node) {
        target.appendChild(node);
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
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
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
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
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
        let c = new Array(buf.length).fill(0);
        for (let i = 0; i < buf.length; i++) {
            for (let j = 0; j < buf.length - i; j++) {
                c[i] = c[i] + buf[j] * buf[j + i];
            }
        }

        return c;
    }

    function notEnoughSignal(buf) {
        let rms = 0;
        for (let i = 0; i < buf.length; i++) {
            rms += buf[i] * buf[i];
        }
        rms = Math.sqrt(rms / buf.length);

        return rms < 0.01
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
    function pitchDetection(buf, sampleRate) {
        if (notEnoughSignal(buf)) {
            return -1;
        }
        const threshold = 0.2;    
        buf = buf.slice(getSignalStart(buf, threshold), getSignalEnd(buf, threshold));
    	return sampleRate / getMax(buf);
    }

    function noteFromPitch(frequency) {
    	let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    	return Math.round(noteNum) + 69;
    }

    function frequencyFromNote(note) {
    	return 440 * Math.pow(2, (note - 69) / 12);
    }

    function detuneFromPitch(frequency, note) {
    	return Math.floor(1200 * Math.log(frequency / frequencyFromNote(note)) / Math.log(2));
    }

    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    /* src/GuitarTuner.svelte generated by Svelte v3.46.4 */

    function create_fragment(ctx) {
    	let main;
    	let p0;
    	let t0;
    	let t1;
    	let t2;
    	let p1;
    	let t3;
    	let t4_value = Math.round(/*pitch*/ ctx[0]) + "";
    	let t4;
    	let t5;
    	let p2;
    	let t6;
    	let t7_value = noteStrings[/*note*/ ctx[1] % 12] + "";
    	let t7;
    	let t8;
    	let p3;
    	let t9;
    	let t10_value = Math.abs(/*detune*/ ctx[2]) + "";
    	let t10;

    	return {
    		c() {
    			main = element("main");
    			p0 = element("p");
    			t0 = text("Using device: ");
    			t1 = text(/*device*/ ctx[3]);
    			t2 = space();
    			p1 = element("p");
    			t3 = text("Hz: ");
    			t4 = text(t4_value);
    			t5 = space();
    			p2 = element("p");
    			t6 = text("Note: ");
    			t7 = text(t7_value);
    			t8 = space();
    			p3 = element("p");
    			t9 = text("Detune: ");
    			t10 = text(t10_value);
    			this.c = noop;
    			attr(p0, "id", "device");
    			attr(p1, "id", "pitch");
    			attr(p2, "id", "note");
    			attr(p3, "id", "detune");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, p0);
    			append(p0, t0);
    			append(p0, t1);
    			append(main, t2);
    			append(main, p1);
    			append(p1, t3);
    			append(p1, t4);
    			append(main, t5);
    			append(main, p2);
    			append(p2, t6);
    			append(p2, t7);
    			append(main, t8);
    			append(main, p3);
    			append(p3, t9);
    			append(p3, t10);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*device*/ 8) set_data(t1, /*device*/ ctx[3]);
    			if (dirty & /*pitch*/ 1 && t4_value !== (t4_value = Math.round(/*pitch*/ ctx[0]) + "")) set_data(t4, t4_value);
    			if (dirty & /*note*/ 2 && t7_value !== (t7_value = noteStrings[/*note*/ ctx[1] % 12] + "")) set_data(t7, t7_value);
    			if (dirty & /*detune*/ 4 && t10_value !== (t10_value = Math.abs(/*detune*/ ctx[2]) + "")) set_data(t10, t10_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let pitch = -1;
    	let note = '';
    	let detune = 0;
    	let device = '';

    	onMount(async () => {
    		const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
    			console.error(err);
    		});

    		let audioTracks = stream.getAudioTracks();
    		$$invalidate(3, device = audioTracks[0].label);
    		let AudioContext = window.AudioContext || window.webkitAudioContext || navigator.mozGetUserMedia;
    		let aCtx = new AudioContext();
    		const analyser = aCtx.createAnalyser();
    		analyser.fftSize = 2048;
    		analyser.connect(aCtx.destination);
    		const microphone = aCtx.createMediaStreamSource(stream);
    		microphone.connect(analyser);
    		let fData = new Float32Array(analyser.frequencyBinCount);

    		(function updateCanvas() {
    			analyser.getFloatTimeDomainData(fData);
    			$$invalidate(0, pitch = pitchDetection(fData, aCtx.sampleRate));
    			$$invalidate(1, note = noteFromPitch(pitch));
    			$$invalidate(2, detune = detuneFromPitch(pitch, note));
    			requestAnimationFrame(updateCanvas);
    		})();
    	});

    	return [pitch, note, detune, device];
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
    			{},
    			null
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}
    		}
    	}
    }

    customElements.define("guitar-tuner", GuitarTuner);

    return GuitarTuner;

}());
