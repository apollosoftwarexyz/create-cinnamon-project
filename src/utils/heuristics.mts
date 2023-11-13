import OperatingSystem from 'node:os';
import FileSystem from 'node:fs';
import Path from 'node:path';

import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Arguments } from "./arguments.mjs";

/**
 * Represents a directory that the user intends to create a project in.
 * This class is used to resolve the intended directory with heuristics and
 * provide additional information about the directory to the user.
 */
export class IntendedDirectoryResolution {
    /**
     * The path to a temporary directory that can be used to prepare this
     * directory for a project.
     * If not set, the directory has not been prepared so
     * {@link ensureTemporaryDirectoryExists} should be called first.
     *
     * @private
     */
    private _temporaryPath?: string;

    public get temporaryPath(): string { return this._temporaryPath!; }

    constructor(
        public readonly path: string,
        public readonly note?: string
    ) {
        this.path = path;
        this.note = note;
    }

    /**
     * Returns a human-readable message that can be used to confirm that the
     * user wants to continue in the directory with the given message.
     *
     * Additional information about the directory collected during the
     * resolution process is included in the message.
     *
     * @param message The message to include in the confirmation message.
     */
    public confirmationMessage(message: string) {
        let note = this.note ? ` — ${this.note}` : "";
        return `${message} (${this.path})${note}`;
    }

    /**
     * Ensures that the directory exists.
     */
    public async ensureDirectoryExists() : Promise<void> {
        if (!await promisify(FileSystem.exists)(this.path)) {
            await promisify(FileSystem.mkdir)(this.path, {
                recursive: true
            });
        }
    }

    /**
     * Prepares a temporary directory for the current directory. If
     * <code>inDir</code> is true, the temporary directory will be created
     * inside the current directory. Otherwise, it will be created in the
     * system temporary directory for performance reasons on certain system
     * configurations (e.g., where the user's primary working directory is a
     * network drive).
     *
     * The temporary directory is prepared only once unless deleted. If it has
     * already been prepared and still exists, the existing temporary directory
     * is returned instead and the <code>inDir</code> parameter is ignored.
     *
     * @param inDir Whether the temporary directory should be created inside
     *              the current directory.
     * @returns The path to the temporary directory.
     * @see {@link temporaryPath} which just asserts that the temporary
     *     directory exists.
     */
    public async ensureTemporaryDirectoryExists(inDir?: boolean) : Promise<string> {
        // If the temporary directory has already been created and still
        // exists, return it.
        if (this._temporaryPath &&
            await promisify(FileSystem.exists)(this._temporaryPath)) {
            return this._temporaryPath;
        }

        let temporaryDirectory;

        // If the temporary directory must be created inside the current
        // directory, do so.
        if (inDir) {
            temporaryDirectory = Path.join(this.path, ".cinnamon-temporary");
            await promisify(FileSystem.mkdir)(temporaryDirectory, {
                recursive: true
            });
        }
        // Otherwise, create it in the system temporary directory.
        else {
            temporaryDirectory = await promisify(FileSystem.mkdtemp)(
                Path.join(OperatingSystem.tmpdir(), "cinnamon-")
            );
        }

        return this._temporaryPath = temporaryDirectory;
    }

    /**
     * Chooses a name for the project. For now, based on the directory name.
     */
    public async chooseDefaultProjectName(): Promise<string> {
        return Path.basename(this.path);
    }

    /**
     * Compute the relative path from the specified to this directory.
     * @param otherPath The other path to compute the relative path from.
     */
    public async relativeTo(otherPath: string) {
        return Path.relative(otherPath, this.path);
    }
}

/**
 * Resolves the intended directory with heuristics. If the user did not pass
 * any positional arguments, the current working directory is used. Otherwise,
 * the first positional argument is used.
 *
 * @param args The arguments passed to the program.
 */
export async function resolveIntendedDirectory(args: Arguments): Promise<IntendedDirectoryResolution> {
    if (args.hasNoPositionalArguments) return new IntendedDirectoryResolution(process.cwd());

    const relativeDir = Path.resolve(args.positional[0]);
    if (!(await promisify(FileSystem.exists)(relativeDir))) {
        return new IntendedDirectoryResolution(relativeDir, "it will be created.");
    }

    return new IntendedDirectoryResolution(relativeDir);
}

/**
 * Returns a reason why the directory might be undesirable if the given path
 * is probably a directory that we don't want to create a project in.
 * Otherwise, returns undefined.
 *
 * The string returned is a human-readable phrase explaining why the directory
 * is undesirable and is of the form such that it can be used in a sentence
 * like "Project creation was cancelled because {reason}".
 *
 * @param path The path to check.
 */
export async function isProbablyUndesirableDirectory(path: string): Promise<string | undefined> {
    const absolutePath = Path.resolve(path);

    // If the directory doesn't exist, we can make a project there.
    if (!await promisify(FileSystem.exists)(absolutePath)) {
        return;
    }

    // Don't make a project in the user's home directory.
    if (absolutePath == OperatingSystem.homedir()) {
        return "you are in your home directory.";
    }

    // Don't make a project in the root directory.
    if (absolutePath == "/") {
        return "you are in your system root directory.";
    }

    // If the user does not have permission to write to the directory, don't
    // make a project there.
    try {
        await promisify(FileSystem.access)(absolutePath, FileSystem.constants.W_OK);
    } catch (ex) {
        return "you do not have permission to write to the directory.";
    }

    // Don't make a project in a directory that already has a package.json file.
    if (await promisify(FileSystem.exists)(Path.join(absolutePath, "package.json"))) {
        return "the directory already has a package.json file.";
    }

    // Don't make a project in a directory that already has a cinnamon.toml file.
    // TODO: maybe we should allow this, but read values from the cinnamon.toml
    //       file and use them as defaults for the project? (assuming that we
    //       can detect that there is not an existing project in the directory)
    if (await promisify(FileSystem.exists)(Path.join(absolutePath, "cinnamon.toml"))) {
        return "the directory already has a cinnamon.toml file.";
    }

    // Don't make a project in a directory that already has a node_modules
    // directory.
    if (await promisify(FileSystem.exists)(Path.join(absolutePath, "node_modules"))) {
        return "the directory already has a node_modules directory.";
    }

    // Don't make a project in a directory that already has a yarn.lock or
    // package-lock.json file.
    if (await promisify(FileSystem.exists)(Path.join(absolutePath, "yarn.lock"))) {
        return "the directory already has a yarn.lock file.";
    }

    if (await promisify(FileSystem.exists)(Path.join(absolutePath, "package-lock.json"))) {
        return "the directory already has a package-lock.json file.";
    }

    // Don't make a project in a directory that contains more than 3 folders or
    // 5 files.
    const contents = await promisify(FileSystem.readdir)(absolutePath);
    const stats = await Promise.all(contents.map((file) => promisify(FileSystem.stat)(Path.join(absolutePath, file))));
    const folders = stats.filter((stat) => stat.isDirectory());
    const files = stats.filter((stat) => stat.isFile());
    if (folders.length > 3 || files.length > 5) {
        // We can assume that if the directory contains more than 3 folders or
        // 5 files, it is probably being used for something else, rather than
        // having been prepared for a Cinnamon project.
        return "the directory seems to be used for something else.";
    }
}

/**
 * Locates the specified path relative to the create-cinnamon-project root path.
 * @param path The path to locate.
 * @returns The absolute path to the specified path.
 */
export function locateRelativeProjectPath(path: string): string {
    // This file is in src/utils, so we need to go up two directories to get to
    // the root directory.
    let containingDir = Path.dirname(fileURLToPath(import.meta.url));
    return Path.join(containingDir, "..", "..", path);
}
