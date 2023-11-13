// Heavily modified from: https://github.com/bokub/chalk-animation/tree/master
// MIT License

import chalk from 'chalk';
import { Spinner } from 'cli-spinners';

abstract class Animator {
    // The timer used to trigger rendering the next frame.
    private _renderNextFrameTimer?: NodeJS.Timeout;

    // Whether the animation has been stopped.
    private _stopped: boolean = false;

    /** Returns true if the animation is not running. */
    public get stopped() { return this._stopped; }

    // The current frame number.
    protected frame: number = 0;

    /**
     * A list of callbacks to trigger per frame.
     */
    private readonly _onFrame: ((frame: string) => void)[] = [];

    /**
     * The speed of the current animation.
     */
    public readonly speed: number;

    /**
     * The interval, in milliseconds, between each frame.
     */
    public abstract readonly interval: number;

    /**
     * Whether the animation is in silent mode. When in silent mode, the
     * animation will not print to the console.
     *
     * This is set to false by default, but can be set to true by passing
     * <code>{ silent: true }</code> to {@link start}.
     *
     * This might be useful when you're using the animation elsewhere and want
     * to print the frame to the console yourself.
     *
     * @see start
     * @private
     */
    private silent: boolean = false;

    protected constructor(speed: number) {
        if (!speed || speed <= 0) {
            throw new Error('Expected `speed` to be an number greater than 0');
        }

        this.speed = speed;
    }

    public start(options?: {
        silent?: boolean
    }): void {
        this.silent = options?.silent ?? false;
        this._stopped = false;

        this._renderNextFrameTimer = setInterval(() => {
            if (!this._stopped) this.render();
            else this.stop();
        }, this.interval);
    }

    public stop(): void {
        if (this._renderNextFrameTimer !== undefined) {
            clearInterval(this._renderNextFrameTimer);
            this._renderNextFrameTimer = undefined;
        }

        this._stopped = true;
    }

    /**
     * Returns {@link renderCurrentRawFrame} wrapped with ANSI control sequences
     * to move the cursor to the top of the frame and clear the lines.
     *
     * Useful when you're using the animation standalone and want to print the
     * frame to the console.
     *
     * This is the default printed to the console when <code>silent</code> is
     * false.
     *
     * If the {@link Animator} does not support or use ANSI control sequences,
     * this method will return the same as {@link renderCurrentRawFrame}.
     *
     * @see renderCurrentRawFrame - used by this method to obtain the frame,
     *                              internally and the version given to the
     *                              callbacks.
     */
    public renderCurrentFrame(): string {
        return this.processRawFrame(this.renderCurrentRawFrame());
    }

    /**
     * Returns the current frame without ANSI control sequences. This can be
     * useful when mixing the output of the animator with other text.
     *
     * This version is given to the callbacks for that reason. If you want the
     * version of the frame with all the ANSI control sequences, use
     * {@link renderCurrentFrame} instead.
     *
     * @returns The current frame without ANSI control sequences.
     */
    public abstract renderCurrentRawFrame(): string;

    /**
     * Use this in your {@link renderCurrentFrame} implementation to process
     * the raw frame before returning it to save having to re-implement
     * {@link render} and {@link renderCurrentRawFrame} to do so.
     *
     * The only time you should need to avoid this method and re-implement the
     * aforementioned methods is if you have to totally alter the frame to
     * include ANSI control sequences (such that it is easier to just build the
     * frame from scratch).
     *
     * @param rawFrame The raw frame to process from
     *                 {@link renderCurrentRawFrame}.
     * @protected
     */
    protected processRawFrame(rawFrame: string): string {
        return rawFrame;
    }

    protected render() {
        // Obtain the current frame and immediately fire all registered
        // callbacks.
        const currentRawFrame = this.renderCurrentRawFrame();
        this.notifyFrame(currentRawFrame);

        // Then, if we're not in silent mode, print the frame to the console.
        if (!this.silent) console.error(this.processRawFrame(currentRawFrame));

        // Finally, increment the frame counter.
        this.frame++;
    }

    /**
     * Adds a callback to be triggered per frame. The callback will be given
     * the frame without ANSI control sequences (as would be returned by
     * {@link renderCurrentRawFrame}).
     * @param callback The callback to trigger per frame.
     */
    public addOnFrameCallback(callback: (frame: string) => void): void {
        this._onFrame.push(callback);
    }

    /**
     * Removes a callback that was previously added with
     * {@link addOnFrameCallback}.
     * @param callback The callback to remove.
     */
    public removeOnFrameCallback(callback: (frame: string) => void): void {
        const index = this._onFrame.indexOf(callback);
        if (index !== -1) this._onFrame.splice(index, 1);
    }

    /**
     * Triggers all registered callbacks with the given frame. You should call
     * this method when rendering a frame, as soon as the frame is ready.
     * @param frame The frame to trigger the callbacks with.
     * @protected
     */
    protected notifyFrame(frame: string) {
        this._onFrame.forEach(callback => callback(frame));
    }
}

export class TextAnimator<T extends TextEffect<any>> extends Animator {
    private _text: string[];

    /**
     * The effect to use for the animation.
     */
    public get effect(): T { return this._effect; }
    public set effect(effect: T) {
        this._effect = effect;

        // Re-play the current frame to ensure the frame is rendered with the
        // new effect.
        this.frame--;
        this.render();
    }

    private _effect: T;

    /**
     * Sets the text to be animated.
     * @param text The text to be animated.
     */
    public set text(text: string) {
        this._text = text.split(/\r\n|\r|\n/);

        // Re-play the current frame to ensure the frame is rendered with the
        // new text.
        this.frame--;
        this.render();
    }

    /**
     * Returns the text given to the animator, but normalized to use `\n` as
     * the line separator.
     */
    public get text() { return this._text.join('\n'); }

    /**
     * Returns the number of lines in the text being animated.
     */
    public get lines() {
        return this.text.length;
    }

    public get interval() {
        return this.effect.delay / this.speed;
    }

    public constructor(text: string,
        effect: T,
                       speed: number = 1) {
        super(speed);

        this._text = text.split(/\r\n|\r|\n/);
        this._effect = effect;
    }

    public renderCurrentRawFrame(): string {
        return this._text.map((str: string) => this.effect.render(str, this.frame)).join('\n');
    }

    protected processRawFrame(frame: string): string {
        return '\u001B[' + this.lines + 'F\u001B[G\u001B[2K' + frame;
    }
}

export class FramesAnimator extends Animator {

    private readonly _frames: string[];
    public readonly interval: number;

    constructor(frames: string[],
        interval: number,
                speed: number = 1) {
        super(speed);

        this._frames = frames;
        this.interval = interval;
    }

    renderCurrentRawFrame(): string {
        return this._frames[this.frame % this._frames.length];
    }

}

export class SpinnerAnimator extends FramesAnimator {

    constructor(spinner: Spinner,
        color?: [number, number, number],
                speed: number = 1) {
        if (color) spinner = SpinnerAnimator.recolorSpinner(spinner, color);
        super(spinner.frames, spinner.interval, speed);
    }

    private static recolorSpinner(spinner: Spinner, color: [number, number, number]) : Spinner {
        return {
            ...spinner,
            frames: spinner.frames.map(frame => chalk.rgb(...color)(frame))
        };
    }

}

export abstract class TextEffect<T> {
    public abstract readonly delay: number;
    public abstract render(text: string, frame: number): string;
    protected constructor(public readonly options: T) {}

    public static radar = (options?: Partial<SnekEffectOptions>) => new SnekEffect(options);
}

interface SnekEffectOptions {
    highlightColor: [number, number, number];
    backgroundColor: [number, number, number];
}

// / Simplified radar effect for performance (named snake/'snek'). :)
class SnekEffect extends TextEffect<SnekEffectOptions> {
    delay = 30;

    constructor(options?: Partial<SnekEffectOptions>) {
        super(Object.assign({
            highlightColor: [255, 255, 255],
            backgroundColor: [150, 150, 150],
        }, options ?? {}) as SnekEffectOptions);
    }

    render(text: string, frame: number) {
        const lengthFactor = Math.max(text.length, 50);

        const depth = Math.floor(Math.min(lengthFactor, lengthFactor * 0.2));
        const globalPos = frame % (text.length + depth);

        const startColoredSubstring = globalPos - depth;
        const endColoredSubstring = globalPos;

        let coloredSubstring = text.substring(startColoredSubstring, endColoredSubstring);
        coloredSubstring = chalk.rgb(...this.options.highlightColor)(coloredSubstring);
        const colorUncoloredText = chalk.rgb(...this.options.backgroundColor);

        return [
            colorUncoloredText(text.substring(0, startColoredSubstring)),
            coloredSubstring,
            colorUncoloredText(text.substring(endColoredSubstring))
        ].join('');
    }
}

export function createTextAnimation<T>(text: string,
    effect: TextEffect<T>,
    speed: number = 1): TextAnimator<TextEffect<T>> {
    return new TextAnimator(text, effect, speed);
}

export function createSpinnerAnimation(spinner: Spinner,
    color?: [number, number, number],
    speed: number = 1): SpinnerAnimator {
    return new SpinnerAnimator(spinner, color, speed);
}

class AnimatorMultiplexer {
    private readonly _animators: Animator[];
    private readonly _animatorFrameHandlers: ((frame: string) => void)[] = [];

    private _frames: ({ frame: string; animator: Animator })[] = [];
    private readonly _onFrame: ((frame: string) => void)[] = [];

    public get stopped() { return this._animators.every(animator => animator.stopped); }

    public constructor(...animators: Animator[]) {
        this._animators = animators;
    }

    public start() {
        for (let i = 0; i < this._animators.length; i++) {
            const animator = this._animators[i];

            animator.start({ silent: true });
            animator.addOnFrameCallback(
                this._animatorFrameHandlers[i] = (frame: string) => {
                    this._frames[i] = { frame, animator };
                    this._triggerFrame();
                }
            );
        }
    }

    public stop() {
        for (let i = 0; i < this._animators.length; i++) {
            this._animators[i].removeOnFrameCallback(this._animatorFrameHandlers[i]);
            this._animators[i].stop();
        }

        this._frames = [];
    }

    public _triggerFrame() {
        const frames = this._frames
            .filter((animatorFrame) => !animatorFrame.animator.stopped)
            .map((animatorFrame) => animatorFrame.frame);

        const frame = frames.join(' ') + '\n';
        this._onFrame.forEach(callback => callback(frame));
    }

    public addOnFrameCallback(callback: (frame: string) => void) {
        this._onFrame.push(callback);
    }

    public removeOnFrameCallback(callback: (frame: string) => void) {
        const index = this._onFrame.indexOf(callback);
        if (index !== -1) this._onFrame.splice(index, 1);
    }
}

export class SpinnerWithTextAnimation<T extends TextAnimator<TextEffect<any>>> extends AnimatorMultiplexer {
    private readonly spinnerAnimator: SpinnerAnimator;
    private readonly textAnimator: TextAnimator<TextEffect<T>>;

    public get text() { return this.textAnimator.text; }
    public set text(text: string) { this.textAnimator.text = text; }

    public get textEffect() { return this.textAnimator.effect; }
    public set textEffect(effect: TextEffect<T>) { this.textAnimator.effect = effect; }

    public get spinnerActive() { return !this.spinnerAnimator.stopped; }
    public set spinnerActive(active: boolean) {
        if (active) this.spinnerAnimator.start({ silent: true });
        else this.spinnerAnimator.stop();
        this._triggerFrame();
    }

    constructor(spinner: SpinnerAnimator, text: T) {
        super(spinner, text);
        this.spinnerAnimator = spinner;
        this.textAnimator = text;
    }
}

export function createSpinnerTextAnimation<T>(spinner: SpinnerAnimator,
    text: TextAnimator<TextEffect<T>>): SpinnerWithTextAnimation<TextAnimator<TextEffect<T>>> {
    return new SpinnerWithTextAnimation(spinner, text);
}
