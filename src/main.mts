import * as fs from 'node:fs';
import { promisify } from 'node:util';

import inquirer from 'inquirer';
import { AnimatedBottomBar, askUserForProjectFeatures, confirm, error, skip } from './utils/console.mjs';
import {
    getDefaultProjectAuthorName,
    isProbablyUndesirableDirectory,
    locateRelativeProjectPath,
    resolveIntendedDirectory
} from './utils/heuristics.mjs';
import { Arguments } from './utils/arguments.mjs';
import { CinnamonProject, CinnamonProjectFeatureType } from './struct/project.mjs';
import { kebabify } from './utils/language.mjs';
import { hasYarn } from './utils/command.mjs';
import chalk from 'chalk';

const TEMPLATES_DIRECTORY = locateRelativeProjectPath('templates');

// noinspection JSUnusedGlobalSymbols - this is used by the CLI.
export async function main(rawArgs: string[]) {
    if (!await hasYarn()) {
        error([
            'Yarn is required to create a Cinnamon project.',
            'Please install Yarn and add it to your PATH and try again.'
        ]);

        return process.exit(1);
    }

    // Ensure the templates directory exists, and that the default template is
    // present.
    if (!await promisify(fs.exists)(TEMPLATES_DIRECTORY) &&
        !await promisify(fs.exists)(`${TEMPLATES_DIRECTORY}/default.tar.gz`)) {
        error([
            'The Cinnamon project templates are missing. Please reinstall create-cinnamon-project.',
            'If this problem persists, please report it to Apollo Software Limited.',
            '(ASL only: report this to the Internal Projects team.)'
        ]);

        return process.exit(1);
    }

    // Parse the arguments.
    const args = new Arguments(rawArgs);

    // Resolve the intended directory with heuristics.
    const targetDirectory = await resolveIntendedDirectory(args);

    // If the target directory is undesirable, skip project creation.
    const isUndesirableReason = await isProbablyUndesirableDirectory(targetDirectory.path);
    if (isUndesirableReason) {
        return skip(`Project creation was skipped because ${isUndesirableReason}`);
    }

    // Confirm that the user wants to continue in the target directory.
    if (!await confirm(
        targetDirectory.confirmationMessage('Do you want to continue in this directory?')
    )) {
        return skip('Project creation was cancelled.');
    }

    // Ensure the target directory exists.
    await targetDirectory.ensureDirectoryExists();

    // Attempt to create a temporary directory to prepare the project in.
    // We do this before asking questions to ensure project creation doesn't
    // fail after the user has entered a bunch of information.
    // TODO: allow user to specify whether this should be in the system temp-dir.
    await targetDirectory.ensureTemporaryDirectoryExists();

    // Ask the user for basic information about the project.
    let { name, author, port } = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'What is the name of your project? (Please use kebab-case.)',
            default: kebabify(await targetDirectory.chooseDefaultProjectName()),
            validate(input: any): boolean | string | Promise<boolean | string> {
                if (!input) {
                    return 'Please enter a name for your project.';
                }

                if (!input.match(/^[a-z0-9-]+$/)) {
                    return 'Please use kebab-case.';
                }

                return true;
            }
        },
        {
            type: 'input',
            name: 'author',
            default: getDefaultProjectAuthorName(),
            message: 'What should the author name be for your project? (this can be you, or a company)',
            transformer(input: any): string {
                if (input.toLowerCase() == 'asl') {
                    return 'Apollo Software Limited';
                }

                return input;
            },
            validate(input: any): boolean | string | Promise<boolean | string> {
                if (!input) {
                    return 'Please enter an author name for your project.';
                }

                return true;
            }
        },
        {
            type: 'number',
            name: 'port',
            message: 'What port should your project run on? (try to pick a unique port)',
            default: Math.floor(Math.random() * (65535-1024) + 1024),
            validate(input: number): boolean | string | Promise<boolean | string> {
                if (!input) {
                    return 'Please enter a port for your project.';
                }

                if (input < 1024) {
                    return 'Please avoid port numbers below 1024, as they are reserved for system services.';
                }

                if (input > 65535) {
                    return 'Please enter a valid port number (must be less than 65535).';
                }

                return true;
            }
        }
    ]);

    name = kebabify(name);
    if (author.toLowerCase() == 'asl') author = 'Apollo Software Limited';
    const project = new CinnamonProject(targetDirectory, name, author, port);

    // Ask the user which features they want to include in the project.
    await askUserForProjectFeatures(project);

    const progress = new AnimatedBottomBar(
        'Configuring your new Cinnamon project, please wait...',
    );
    progress.open();

    // Extract to the temporary directory.
    const writtenFiles = await project.extractTemplateToTemporaryDirectory(TEMPLATES_DIRECTORY);
    await project.configure(writtenFiles);

    // Commit the configured files to the target directory.
    progress.text = 'Copying files to project directory...';
    await project.commit();

    // Remove the temporary directory.
    progress.text = 'Cleaning up temporary files...';
    await project.removeTemporaryDirectory();

    // Perform a "yarn" install.
    progress.text = 'Installing dependencies...';
    try {
        await project.install({
            withStdout: (stream) => {
                stream.pipe(progress.log);
            },
            withStderr: (stream) => {
                stream.pipe(progress.log);
            }
        });
    } catch (ex) {
        console.error(ex);
        error([
            'An error occurred while installing dependencies.',
            'Please report this to Apollo Software Limited.'
        ]);
        return process.exit(1);
    }

    progress.skipLine();

    let wasDatabaseMigrated = false;

    // If database support is enabled, migrate the database.
    if (project.features.get(CinnamonProjectFeatureType.DATABASE)) {
        progress.text = 'Setting up database...';

        try {
            try {
                for await (const status of project.migrateDatabase()) {
                    progress.text = status;
                }

                wasDatabaseMigrated = true;
            } catch (ex) {
                progress.skip('Skipping database migration (database requires additional configuration).');
                wasDatabaseMigrated = false;
            }
        } catch (ex) {
            console.error(ex);
            error([
                'An error occurred while migrating the database.',
                'Please report this to Apollo Software Limited.'
            ]);
            return process.exit(1);
        }
    }

    progress.skipLine();

    progress.success([
        '🎉 Yay, your Cinnamon project has been created successfully!',
        '',
        "First, you'll need to enter the project directory:",
        '',
        chalk.green(`    cd ${await project.directory.relativeTo(process.cwd())}`),
        ...(wasDatabaseMigrated || !project.features.get(CinnamonProjectFeatureType.DATABASE) ? [''] : [
            '',
            chalk.yellowBright("Next, you'll need to migrate the database:"),
            '',
            chalk.yellowBright("-  You're seeing this because you enabled database support but Cinnamon"),
            chalk.yellowBright("     couldn't connect to the database or automatically perform migrations.)"),
            '',
            chalk.yellow('    yarn db:migrate:create'),
            chalk.yellow('    yarn db:migrate'),
            '',
        ]),
        'Then, you can start your project with:',
        '',
        chalk.green('    yarn start'),
        '',
        'If you need help, you can find the documentation at:',
        '',
        chalk.green(`    ${chalk.italic(chalk.underline('https://docs.apollosoftware.xyz/cinnamon'))}`),
        ''
    ]);
}
