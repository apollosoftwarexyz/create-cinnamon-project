import * as constants from 'node:constants';
import { access, stat, readFile, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

import { pipeline } from 'node:stream/promises';

import * as path from 'node:path';
import * as tar from 'tar';

export function computeHash(buffer: Buffer) {
    return createHash('sha256').update(buffer).digest().toString('hex');
}

export async function hashFile(filename: string) {
    const file = await readFile(filename);
    return computeHash(file);
}

interface HashedFilePath {
    path: string;
    hash: string;
}

export class TarFile {

    constructor(
        private readonly filename: string,
    ) {}

    async exists() {
        try {
            await access(this.filename, constants.R_OK);
            return true;
        } catch (ex) { return false; }
    }

    async list() {
        let entries: tar.ReadEntry[] = [];

        await tar.list({
            file: this.filename,
            strict: true,
            onentry(entry) {
                entries.push(entry);
            }
        });

        return entries;
    }

    async listHashes() {
        const hashes: Promise<HashedFilePath>[] = [];

        await pipeline(
            createReadStream(this.filename),
            new tar.Parse({ strict: true })
                .on('entry', (entry) => {
                    if (entry.type === 'File') {
                        hashes.push(new Promise((resolve, _) => {
                            entry.concat().then((content: Buffer) => {
                                const filePath = entry.path.replace(/^\.\/?/, '');
                                const hash = computeHash(content);

                                resolve({ path: filePath, hash });
                            });
                        }));
                    }

                    entry.resume();
                })
        );

        return await Promise.all(hashes);
    }

}

export class Directory {

    constructor(
        private readonly dirname: string,
    ) {}

    async exists() {
        try {
            await access(this.dirname);
            return true;
        } catch (ex) { return false; }
    }

    async isDirectory() {
        return (await stat(this.dirname)).isDirectory();
    }

    async listHashes() {
        const files = await Directory.listRecursively(this.dirname);
        const hashes: Promise<HashedFilePath>[] = files
            .map(async (file) => {
                const filePath = path.relative(this.dirname, file);

                return {
                    path: filePath,
                    hash: await hashFile(file),
                };
            });

        return await Promise.all(hashes);
    }

    /** See: https://github.com/apollosoftwarexyz/cinnamon/blob/master/packages/cinnamon-internals/src/internals/namespace/fs.ts */
    private static async listRecursively(directoryPath: string) : Promise<string[]> {

        const discoveredFiles = [];

        for (const filePath of await readdir(directoryPath)) {
            const absoluteFilePath = path.join(directoryPath, filePath);

            // If the current 'file' is a directory, search _it_ recursively
            // with the same function.
            if ((await stat(absoluteFilePath)).isDirectory())
                discoveredFiles.push(...await Directory.listRecursively(absoluteFilePath));
            // Otherwise, add the absolute file path we discovered to the list.
            else discoveredFiles.push(absoluteFilePath);
        }

        return discoveredFiles;

    }

}

export class ChangesAnalyzer {

    constructor(
        private readonly tarFile: TarFile,
        private readonly directory: Directory,
    ) {}

    public async diff() {
        const tarHashes = await this.tarFile.listHashes();
        const directoryHashes = await this.directory.listHashes();

        const tarHashesMap = new Map(tarHashes.map(h => [h.path, h]));
        const directoryHashesMap = new Map(directoryHashes.map(h => [h.path, h]));

        const tarHashesSet = new Set(tarHashes.map(h => h.path));
        const directoryHashesSet = new Set(directoryHashes.map(h => h.path));

        const added = [...directoryHashesSet].filter(path => !tarHashesSet.has(path));
        const removed = [...tarHashesSet].filter(path => !directoryHashesSet.has(path));
        const changed = [...tarHashesSet].filter(path => {
            if (added.includes(path)) return false;
            if (removed.includes(path)) return false;

            const tarHash = tarHashesMap.get(path);
            const directoryHash = directoryHashesMap.get(path);

            return tarHash?.hash !== directoryHash?.hash;
        });

        return { added, removed, changed };
    }

}

async function main(args: string[]) {
    if (args.length < 2) {
        console.error('Usage: compare <tarfile> <directory>');
        return;
    }

    const tarFile = new TarFile(args[0]);
    if (!await tarFile.exists()) {
        console.error(`File not found: ${args[0]}`);
        return;
    }

    const directory = new Directory(args[1]);
    if (!await directory.exists()) {
        console.error(`Directory not found: ${args[1]}`);
        return;
    }

    if (!await directory.isDirectory()) {
        console.error(`Not a directory: ${args[1]}`);
        console.error(`Usage: compare <tarfile> <directory>`);
        return;
    }

    const changes = new ChangesAnalyzer(tarFile, directory);
    console.log(await changes.diff());
}

main(process.argv.slice(2))
    .then(_ => process.exit(0))
    .catch(ex => {
        console.error(ex);
        process.exit(1);
    });
