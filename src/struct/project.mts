import { feature, FeatureForest, FeatureNodeMetadata, forest, node } from './generic/feature_tree.mjs';
import { IntendedDirectoryResolution } from '../utils/heuristics.mjs';

import Path from 'node:path';
import { extract, ReadEntry } from 'tar';
import { promisify } from 'util';
import FileSystem from 'node:fs';
import { yarn, YarnOptions } from '../utils/command.mjs';

export enum CinnamonProjectFeatureType {
    VALIDATOR = 'VALIDATOR',
    DATABASE = 'DATABASE',
    AUTHENTICATION = 'AUTHENTICATION',
    PUSH_TOKENS = 'PUSH_TOKENS',
    ASSET = 'ASSET',
    AVATAR = 'AVATAR',
    ASL_PROTOCOL = 'ASL_PROTOCOL',
    ASL_ERRORS = 'ASL_ERRORS',
    WEBSERVER_SETTINGS_PLUGIN = 'WEBSERVER_SETTINGS_PLUGIN',
}

export function getCinnamonFeatureTypeById(id: string): CinnamonProjectFeatureType {
    const feature = CinnamonProjectFeatureType[id as keyof typeof CinnamonProjectFeatureType];
    if (!feature) throw new TypeError(`Invalid CinnamonProjectFeatureType: ${id}`);
    return feature;
}

export const CinnamonProjectFeature: Record<CinnamonProjectFeatureType, FeatureNodeMetadata<CinnamonProjectFeatureType>> = {
    VALIDATOR: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.VALIDATOR,
        'Cinnamon Validator',
        'Provides data validation with human-readable error messages.'
    ),
    DATABASE: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.DATABASE,
        'Cinnamon Database (powered by MikroORM)',
        'Connect to a database and manage data with MikroORM.'
    ),
    AUTHENTICATION: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.AUTHENTICATION,
        'Authentication',
        'Manage user accounts and authenticate users.'
    ),
    PUSH_TOKENS: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.PUSH_TOKENS,
        'Push Tokens',
        'Support for associating push tokens for mobile devices with a user session.'
    ),
    ASSET: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.ASSET,
        'Assets',
        'Support for storing assets (e.g., profile avatars/pictures) for users.'
    ),
    AVATAR: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.AVATAR,
        'Avatars',
        'Support for storing profile pictures for users.'
    ),
    ASL_PROTOCOL: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.ASL_PROTOCOL,
        'Apollo Software Limited (ASL) Protocol',
        "Installs the asl-protocol plugin. Adds ASL's request-response middlewares and several convenience features to Cinnamon."
    ),
    ASL_ERRORS: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.ASL_ERRORS,
        'ASL Errors',
        'Adds project/domain-specific error codes and handling to your project. Useful for API projects.'
    ),
    WEBSERVER_SETTINGS_PLUGIN: feature<CinnamonProjectFeatureType>(
        CinnamonProjectFeatureType.WEBSERVER_SETTINGS_PLUGIN,
        'Webserver Settings Plugin',
        'Adds a plugin to your project that allows configuring the proxy mode of the webserver. Useful as a starting point for your own plugins.'
    ),
};

export type CinnamonProjectFeatureForest = FeatureForest<CinnamonProjectFeatureType>;
export const createCinnamonFeatureForest = (): CinnamonProjectFeatureForest => {
    return forest<CinnamonProjectFeatureType>([
        node(CinnamonProjectFeature.VALIDATOR),
        node(CinnamonProjectFeature.DATABASE, [
            node(CinnamonProjectFeature.AUTHENTICATION, [
                node(CinnamonProjectFeature.PUSH_TOKENS),
            ]),
            node(CinnamonProjectFeature.ASSET, [
                node(CinnamonProjectFeature.AVATAR),
            ])
        ]),
        node(CinnamonProjectFeature.ASL_PROTOCOL),
        node(CinnamonProjectFeature.ASL_ERRORS),
        node(CinnamonProjectFeature.WEBSERVER_SETTINGS_PLUGIN),
    ]);
};

/**
 * Represents a Cinnamon project being created.
 */
export class CinnamonProject {

    /**
     * The directory that the project is being created in.
     */
    public readonly directory: IntendedDirectoryResolution;

    /**
     * The name of the project.
     * Substitutes for "{project-name}" in project templates.
     */
    public readonly name: string;

    /**
     * The author of the project.
     * Substitutes for "{project-author}" in project templates.
     */
    public readonly author: string;

    /**
     * The port number for the project.
     * Substitutes for "{port}" in project templates.
     */
    public readonly port: number;

    /**
     * The features that the project will include.
     */
    public readonly features: CinnamonProjectFeatureForest = createCinnamonFeatureForest();

    constructor(directory: IntendedDirectoryResolution, name: string, author: string, port: number) {
        this.directory = directory;
        this.name = name;
        this.author = author;
        this.port = port;
    }

    public async extractTemplateToTemporaryDirectory(templatesDirectory: string, templateName: 'default' = 'default') {
        const files: string[] = [];

        await extract({
            cwd: this.directory.temporaryPath,
            file: Path.join(templatesDirectory, `${templateName}.tar.gz`),
            strict: true,
            newer: true,
            preserveOwner: false,
            onentry(entry: ReadEntry) {
                if (entry.type === 'File') {
                    files.push(entry.path);
                }
            }
        });

        return files;
    }

    // //[BEGIN:ABC]
    // //[END:ABC]
    // //[BEGIN:!ABC]
    // //[END:!ABC]
    //
    // //IF:ABC
    // //IF:ABC,ABC

    /**
     * Parses the specified files and takes actions according to the current
     * project configuration and the create-cinnamon-project markup in the
     * files.
     * @param files The files to configure.
     */
    public async configure(files: string[]) {
        const unneededFiles: string[] = [];

        // Iterate over each file, and remove blocks that are not enabled.
        for (const rawFilePath of files) {
            const file = Path.join(this.directory.temporaryPath, rawFilePath);

            // Read the file.
            let contents = await promisify(FileSystem.readFile)(file, { encoding: 'utf-8' });

            // Check the first line of the file for an include guard.
            const firstLine = contents.split('\n')[0];
            if (firstLine.startsWith('//IF:')) {
                // Get the feature ID.
                const featureIds = firstLine.substring(5).split(',');

                // If any of the feature IDs are not enabled, skip the file.
                if (featureIds.some(featureId => !this.features.get(getCinnamonFeatureTypeById(featureId)))) {
                    unneededFiles.push(file);
                    continue;
                }

                // Remove the include guard (the first line and the newline
                // after it).
                contents = contents.substring(firstLine.length + 1);
            }

            // Find all of the create-cinnamon-project markup in the file.
            const matches = contents.matchAll(/\/\/\[(BEGIN|END):(!?[A-Z][A-Z_]*)]/g);

            function swallowBefore(position: number) {
                if (position <= 0) return position;
                if (contents[position - 1] === '\n') return position - 1;
                return position;
            }

            function swallowAfter(position: number) {
                if (contents.length <= position + 1) return position;
                if (contents[position + 1] === '\n') return position + 1;
                return position;
            }

            // Iterate over each match.
            let deletions: [number, number][] = [];
            for (const match of matches) {
                const [_, type, featureId] = match;
                const feature = getCinnamonFeatureTypeById(
                    featureId.startsWith('!') ? featureId.substring(1) : featureId
                );

                // If this is a BEGIN tag, and the feature is not enabled, skip
                // the block.
                if (type === 'BEGIN' && !featureId.startsWith('!')) {
                    let beforeStartTag = match.index!;

                    // Find the START tag.
                    let startTag = contents.indexOf(`\n`, beforeStartTag);
                    if (startTag === -1) throw new Error(`(Bad template) Could not find START tag for feature block: !${feature}.`);

                    // Find the END tag.
                    let endTag = contents.indexOf(`//[END:${featureId}]`, beforeStartTag);
                    if (endTag === -1) throw new Error(`(Bad template) Could not find END tag for feature block: ${feature}.`);

                    // Find the next newline after the END tag.
                    const afterEndTag = contents.indexOf('\n', endTag);
                    if (afterEndTag === -1) throw new Error(`(Bad template) Could not find EOL following end tag: ${feature}, ${rawFilePath}.`);

                    if (!this.features.get(feature)) {
                        // Remove the block.
                        beforeStartTag = swallowBefore(beforeStartTag);
                        deletions.push([beforeStartTag, afterEndTag]);
                    } else {
                        // Remove the tags.
                        beforeStartTag = swallowBefore(beforeStartTag);
                        startTag = swallowAfter(startTag);
                        endTag = swallowBefore(endTag);

                        deletions.push([beforeStartTag, startTag]);
                        deletions.push([endTag, afterEndTag]);
                    }
                }

                // Handle the BEGIN-NOT and END-NOT tags.
                if (type === 'BEGIN' && featureId.startsWith('!')) {
                    let beforeStartTag = match.index!;

                    // Find the START tag.
                    let startTag = contents.indexOf(`\n`, beforeStartTag);
                    if (startTag === -1) throw new Error(`(Bad template) Could not find START tag for feature block: !${feature}.`);

                    // Find the END tag.
                    let endTag = contents.indexOf(`//[END:${featureId}]`, beforeStartTag);
                    if (endTag === -1) throw new Error(`(Bad template) Could not find END tag for feature block: !${feature}.`);

                    // Find the next newline after the END tag.
                    const afterEndTag = contents.indexOf('\n', endTag);
                    if (afterEndTag === -1) throw new Error(`(Bad template) Could not find EOL following end tag: !${feature}, ${rawFilePath}.`);

                    if (this.features.get(feature)) {
                        // Remove the block.
                        beforeStartTag = swallowBefore(beforeStartTag);
                        deletions.push([beforeStartTag, afterEndTag]);
                    } else {
                        // Remove the tags.
                        beforeStartTag = swallowBefore(beforeStartTag);
                        startTag = swallowAfter(startTag);
                        endTag = swallowBefore(endTag);

                        deletions.push([beforeStartTag, startTag]);
                        deletions.push([endTag, afterEndTag]);
                    }
                }
            }

            // Merge deletions that overlap.
            deletions = deletions.sort((a, b) => a[0] - b[0]);
            for (let i = 0; i < deletions.length - 1; i++) {
                const [start1, end1] = deletions[i];
                const [start2, end2] = deletions[i + 1];

                if (start2 <= end1) {
                    deletions[i] = [start1, Math.max(end1, end2)];
                    deletions.splice(i + 1, 1);
                    i--;
                }
            }

            // Now build the new contents.
            let newContents = '';
            let lastEnd = 0;

            for (const [start, end] of deletions) {
                newContents += contents.substring(lastEnd, start);
                lastEnd = end;
            }

            newContents += contents.substring(lastEnd);

            // Ensure the files does not start with an EOL.
            if (newContents.startsWith('\n')) newContents = newContents.substring(1);

            // Ensure the file ends with an EOL.
            if (!newContents.endsWith('\n')) newContents += '\n';

            // Write the project placeholders into the file.
            newContents = newContents.replace(/\{project-name}/g, this.name);
            newContents = newContents.replace(/\{project-author}/g, this.author);
            newContents = newContents.replace(/\{year}/g, new Date().getFullYear().toString());
            newContents = newContents.replace(/\{port}/g, this.port.toString());

            // Write the file.
            await promisify(FileSystem.writeFile)(file, newContents);
        }

        // Delete all of the unneeded files.
        for (const file of unneededFiles) {
            await promisify(FileSystem.unlink)(file);
        }
    }

    /**
     * Copies all of the files from the temporary directory to the target
     * directory.
     */
    public async commit() {
        await CinnamonProject.recursiveCopy(this.directory.temporaryPath, this.directory.path);
    }

    /**
     * Installs the project dependencies with Yarn.
     */
    public async install(stdio?: YarnOptions['stdio']) {
        await yarn({
            args: ['set', 'version', 'berry'], // Install Yarn 2+
            cwd: this.directory.path,
            stdio
        });

        await yarn({
            args: ['set', 'version', 'latest'], // Switch to latest, now that we have Yarn 2+
            cwd: this.directory.path,
            stdio
        });

        await yarn({
            cwd: this.directory.path,
            stdio
        });
    }

    public async* migrateDatabase() {
        yield 'Generating initial migration...';

        await yarn({
            args: ['db:migrate:create'],
            cwd: this.directory.path,
        });

        yield 'Applying migrations...';

        await yarn({
            args: ['db:migrate'],
            cwd: this.directory.path,
        });

        yield 'Database is ready!';
    }

    public async removeTemporaryDirectory() {
        await promisify(FileSystem.rm)(this.directory.temporaryPath, {
            recursive: true,
            force: true,
        });
    }

    private static async recursiveCopy(source: string, destination: string) {
        const children = await promisify(FileSystem.readdir)(source);

        for (const child of children) {
            const sourceChild = Path.join(source, child);
            const destinationChild = Path.join(destination, child);

            if ((await promisify(FileSystem.stat)(sourceChild)).isDirectory()) {
                await promisify(FileSystem.mkdir)(destinationChild);
                await this.recursiveCopy(sourceChild, destinationChild);
            } else {
                await promisify(FileSystem.copyFile)(sourceChild, destinationChild);
            }
        }
    }

}
