import { spawn } from 'node:child_process';
import { lookpath } from 'lookpath';

export async function hasYarn() {
    return await lookpath('yarn') !== undefined;
}

export interface YarnOptions {
    args?: string[];
    cwd?: string;
    stdio?: {
        withStdout?: (stream: NodeJS.ReadableStream) => void;
        withStderr?: (stream: NodeJS.ReadableStream) => void;
    }
}

export async function yarn(options?: YarnOptions) {
    const yarnPath = (await lookpath('yarn'))!;

    const args = options?.args ?? [];
    const cwd = options?.cwd ?? process.cwd();

    return new Promise<void>((resolve, reject) => {
        const yarn = spawn(yarnPath, args, {
            cwd: cwd,
            stdio: 'pipe',
            env: {
                ...process.env,
                FORCE_COLOR: '1',
            }
        });

        if (options?.stdio?.withStdout) options.stdio!.withStdout!(yarn.stdout);
        if (options?.stdio?.withStderr) options.stdio!.withStderr!(yarn.stderr);

        yarn.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(code);
            }
        });
    });
}
