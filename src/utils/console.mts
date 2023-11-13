import chalk, {ChalkInstance} from "chalk";
import inquirer, { CheckboxQuestion, DistinctQuestion } from "inquirer";
import { Subject } from "rxjs";

import {CinnamonProject, CinnamonProjectFeatureType} from "../struct/project.mjs";
import {FeatureNodeMetadata} from "../struct/generic/feature_tree.mjs";
import spinners, {Spinner} from "cli-spinners";
import {
    createSpinnerAnimation, createSpinnerTextAnimation,
    createTextAnimation,
    SpinnerWithTextAnimation, TextEffect
} from "../graphics/animation.mjs";

/**
 * Ask the user to confirm something. Returns true if the user confirms, false
 * otherwise.
 *
 * @param message The message to ask the user.
 */
export const confirm = async (message: string): Promise<boolean> => {
    const { confirmed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message: message,
            default: true,
        },
    ]);

    return confirmed;
}

/**
 * Skip a line in the console. Optionally, a message can be provided to be
 * 'wrapped' by the skip line. That is, the message will be printed on the
 * line after the skip line.
 *
 * @param message Optionally, a message to wrap with the skip line.
 */
export const skipLine = (message?: string): void =>
    console.error("\n" + (message ? message : ""));

/**
 * Skip status. This is used to indicate that a step in the program was skipped.
 * @param message A status message to print.
 */
export const skip = (message: string| string[]): void =>
    console.error(formatMessage(message, "skipped"));

/**
 * Success status. This is used to indicate that a step in the program was
 * completed successfully.
 * @param message A status message to print.
 */
export const success = (message: string|string[]): void =>
    console.error(formatMessage(message, "success"));

/**
 * Error status. This is used to indicate that a step in the program failed.
 * @param message A status message to print.
 */
export const error = (message: string|string[]): void =>
    console.error(formatMessage(message, "error"));

/** The types of message supported by {@link formatMessage}. */
type FormatMessageKind = "info" | "skipped" | "success" | "error";

/**
 * Formats a message with a symbol and title and color-codes it. The message is
 * returned as a string for printing or further processing.
 * @param message The message to format.
 * @param kind The kind of message to format.
 */
export const formatMessage = (message: string|string[], kind: FormatMessageKind): string => {
    // If the message is an empty array, return an empty string.
    // No point in processing an empty message.
    if (Array.isArray(message) && message.length == 0) return "";

    let title: string, symbol: string, color: ChalkInstance, textColor: ChalkInstance | undefined;

    switch (kind) {
        case "info":
            title = "Info";
            symbol = "ℹ️";
            color = chalk.blueBright;
            break;
        case "skipped":
            title = "Skipped";
            symbol = "⏭️";
            color = chalk.whiteBright;
            break;
        case "success":
            title = "Success!";
            symbol = "✅";
            color = chalk.greenBright;
            break;
        case "error":
            title = "Sorry!";
            symbol = "❌";
            color = chalk.redBright;
            textColor = chalk.red;
            break;
    }

    if (!textColor) textColor = color; // set the text color to the same as the symbol color if not set.

    /** Format a line of the message. */
    const formatLine = (line: string, withTitle: boolean = true) => {
        let titleString = withTitle
            ? chalk.bold(color(`   ${symbol}  ${title}  —  `))
            : `      ${' '.repeat(title.length)}     `;
        return titleString + textColor!(line);
    }

    // If the message is just a string, we can print it in one go.
    if (typeof message === "string") {
        return formatLine(message);
    }

    // Otherwise, fully format the first line, then format the remaining lines
    // without the symbol and title.
    let formattedLines = [
        // Add a blank line before the message for readability.
        '',
        // We asserted above that if the message is an array, it is not empty.
        formatLine(message.shift()!),
        // Format the remaining lines without the symbol and title.
        ...message.map(line => formatLine(line, false))
    ];

    // Return the formatted lines joined by newlines.
    return formattedLines.join("\n");
}

/**
 * Prompts the user to select features for the specified
 * {@link CinnamonProject} with inquirer and enables those that were selected.
 * @param project The project to ask the user about.
 */
export async function askUserForProjectFeatures(project: CinnamonProject) : Promise<void> {
    let level = 0;

    const currentQuestions = new Subject<DistinctQuestion>();
    const prompt = inquirer.prompt(currentQuestions);

    let questionForFeatures = (message: string, features: FeatureNodeMetadata<CinnamonProjectFeatureType>[]): CheckboxQuestion => ({
        type: 'checkbox',
        name: 'feature',
        loop: true,
        message: message,
        askAnswered: true,
        choices: features.map(feature => ({
            name: `${chalk.bold(feature.name)} - ${feature.description}`,
            value: feature.id,
        })),
    });

    // Subscribe to responses so we can add more questions if sub-features
    // become available.
    prompt.ui.process.subscribe((answer) => {
        if (answer.name === 'feature') {
            // Enable all of the selected features.
            project.features.enableAll(answer.answer);

            let features = project.features.getFeaturesForLevel(++level);

            // If there are no more features at this level, we're done.
            if (features.length === 0) return currentQuestions.complete();
            // otherwise, ask the next question.
            currentQuestions.next(questionForFeatures(`Would you like to enable these sub-features?`, features));
        }
    });

    // Ask the initial question.
    let features = project.features.getFeaturesForLevel(level);
    currentQuestions.next(questionForFeatures('Which features would you like to include in your project?', features));
    await prompt;
}

export class AnimatedBottomBar {
    private readonly bottomBar: inquirer.ui.BottomBar;
    private readonly spinnerWithText: SpinnerWithTextAnimation<any>;

    /** A log that can be written to (renders above the bottom bar). */
    public get log() { return this.bottomBar.log; }

    /** The RGB color to use for the spinner and highlight. */
    public readonly color: [number, number, number] = [142, 97, 240];

    /** The <code>cli-spinners</code> spinner to use. */
    public readonly spinner: Spinner = spinners.arrow3;

    /** The text to display in the bottom bar. */
    public get text() { return this.spinnerWithText.text; }
    public set text(value: string) {
        if (this.spinnerWithText.stopped) {
            this.bottomBar.updateBottomBar(`${value}\n`);
        }

        this.spinnerWithText.text = value;
    }

    public get loading() { return this.spinnerWithText.spinnerActive; }
    public set loading(value: boolean) {
        this.spinnerWithText.spinnerActive = value;

        if (value) {
            this._startAnimation();
        } else {
            this._stopAnimation();
        }

        this._frameCallback(this.text);
    }

    constructor(text: string) {
        let spinnerAnimator = createSpinnerAnimation(this.spinner, this.color);
        let textAnimator = createTextAnimation(text, TextEffect.radar({
            highlightColor: this.color
        }));

        this.spinnerWithText = createSpinnerTextAnimation(spinnerAnimator, textAnimator);
        this.bottomBar = new inquirer.ui.BottomBar();
    }

    private readonly _frameCallback = (frame: string) => this.bottomBar.updateBottomBar(frame);

    private _startAnimation() {
        this.spinnerWithText.start();
        this.spinnerWithText.addOnFrameCallback(this._frameCallback);
    }

    private _stopAnimation() {
        if (this._frameCallback) {
            this.spinnerWithText.removeOnFrameCallback(this._frameCallback);
        }

        this.spinnerWithText.stop();
    }

    public open() {
        this._startAnimation();
    }

    public close(clear: boolean = true) {
        if (clear) {
            this.loading = false;
            this.text = "";

            // @ts-ignore
            this.bottomBar.clean();
        }

        this._stopAnimation();

        // @ts-ignore
        this.bottomBar.close();
        console.log('');
    }

    public complete(message: string) {
        this.loading = false;
        this.text = message;
        this.close(false);
    }

    public info(message: string|string[]) { this.log.write(`${formatMessage(message, "info")}\n`); }
    public skip(message: string|string[]) { this.log.write(`${formatMessage(message, "skipped")}\n`); }
    public success(message: string|string[]) { this.complete(formatMessage(message, "success")); }
    public error(message: string|string[]) { this.complete(formatMessage(message, "error")); }

    public skipLine() {
        this.log.write("\n");
    }

}
