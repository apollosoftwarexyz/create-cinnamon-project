/**
 * A class that represents the arguments and flags passed to the program.
 *
 * This class parses the arguments automatically and makes them available in a
 * more convenient format by dividing them into positional arguments and flags.
 */
export class Arguments {

    /**
     * The total number of arguments and flags passed to the program.
     */
    get count() { return this.args.length; }

    /**
     * Whether or not there are no arguments or flags (collectively) passed to
     * the program.
     * This is equivalent to `args.count == 0`.
     */
    get hasNoArguments() { return this.count == 0; }

    /**
     * Whether or not there are any arguments or flags (collectively) passed to
     * the program.
     * This is equivalent to `args.count > 0`.
     */
    get hasArguments() { return this.count > 0; }

    /**
     * The positional arguments passed to the program.
     */
    public readonly positional: string[];

    /**
     * Whether or not there are no positional arguments passed to the program.
     * This is equivalent to `positional.length == 0`.
     */
    get hasNoPositionalArguments() { return this.positional.length == 0; }

    /**
     * Whether or not there are any positional arguments passed to the program.
     * This is equivalent to `positional.length > 0`.
     */
    get hasPositionalArguments() { return this.positional.length > 0; }

    /**
     * The flags passed to the program.
     */
    public readonly flags: string[];

    /**
     * Whether or not there are no flags passed to the program.
     * This is equivalent to `flags.length == 0`.
     */
    get hasNoFlags() { return this.flags.length == 0; }

    /**
     * Whether or not there are any flags passed to the program.
     * This is equivalent to `flags.length > 0`.
     */
    get hasFlags() { return this.flags.length > 0; }

    /**
     * Creates a new Arguments instance from the given arguments.
     * @param args The raw arguments passed to the program.
     */
    constructor(private readonly args: string[]) {
        this.positional = args.filter(arg => !arg.startsWith('-'));
        this.flags = args.filter(arg => arg.startsWith('-'));
    }
}
