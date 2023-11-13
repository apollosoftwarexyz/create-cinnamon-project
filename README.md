# create-cinnamon-project

Create a new Cinnamon project with ease.

<center>

[Cinnamon](https://docs.apollosoftware.xyz/cinnamon) | [Apollo Software Limited](https://apollosoftware.xyz/)

</center>

Cinnamon is a framework for building web API backend applications. It is built
on Koa, and provides a declarative syntax for defining routes, middleware, and
more, that 'just works'.

## Prerequisites

Cinnamon is designed around `yarn` 2+, specifically and thus
requires it to be installed. You can install it with:

```bash
$ npm install -g yarn
```

## Expedited Setup

If you want to get started with Cinnamon as quickly as possible and your
project uses a database, before creating your project you should set up a
**PostgreSQL database** with the following credentials:

- **Hostname:** `localhost` (default)
- **Port:** `5432` (default)
- **Database:** `{project-name}`
- **Username:** `{project-name}`
- **Password:** `{project-name}123`

`create-cinnamon-project` will attempt to trigger an automatic database
migration with Cinnamon on project creation, and will use the above
defaults to do so.

Alternatively, pre-define a `cinnamon.toml` file in the root of your project
with the database credentials you wish to use.

> **Tip:** Select all of the features that Cinnamon offers in a stock install
> by pressing <kbd>a</kbd> on all of the feature selection prompts.

## Usage

```bash
$ yarn create cinnamon-project <project-name>
```

or with npm:

```bash
$ npx create-cinnamon-project <project-name>
```

## License

MIT License. See [LICENSE](LICENSE.md) for details.

