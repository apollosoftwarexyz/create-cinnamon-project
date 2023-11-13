import { createPromptModule } from 'inquirer';

async function main(args) {
    if (args.length < 1) { process.exit(1); }
    args = args.filter((arg) => !arg.startsWith('-'));

    let forceKebabCase = process.argv.find((arg) => arg === '--kebab-case');
    let forceSnakeCase = process.argv.find((arg) => arg === '--snake-case');

    let { value } = await createPromptModule({
        skipTTYChecks: true,
        output: process.stderr,
    })([
        {
            type: 'input',
            name: 'value',
            message: args,
            validate(input) {
                if (input.trim().length < 1) {
                    return "Please enter a value";
                }

                return true;
            },
            transformer(input, _, flags) {
                input = input.trimStart();
                if (flags.isFinal) {
                    input = input.trimEnd();
                }

                if (input.length < 1) {
                    return input;
                }

                if (forceKebabCase) {
                    return input.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                }

                if (forceSnakeCase) {
                    return input.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                }

                return input;
            }
        }
    ]);

    if (forceSnakeCase) {
        value = value.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    }

    if (forceKebabCase) {
        value = value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    }

    process.stdout.write(value);
    process.stdout.write('\n');
}

try {
    await main(process.argv.slice(2));
} catch (_) {
    process.exit(2);
}