# Google News CLI 📰

A lightweight, zero-dependency Node.js command-line interface to fetch and search the latest news from Google News.

## Features

- ⚡ **Zero Dependencies**: Uses native Node.js fetch and built-in RegExp XML parser (extremely fast and lightweight).
- 🎨 **Beautiful Formatting**: Structured output with colors, typography, relative time calculation, and clean spacing.
- 🔍 **Search Support**: Search Google News for specific search terms.
- 🏷️ **Topic Filtering**: Filter headlines by category (World, Nation, Business, Technology, Entertainment, Sports, Science, Health).
- 🔢 **Custom Limits**: Control the number of articles displayed.

---

## Installation & Run

Since this application is zero-dependency, you don't need to run `npm install`!

To run it directly from the project folder:

```bash
node index.js
```

### Run globally

If you'd like to link the command globally, run:

```bash
# On Windows, you can link the CLI tool globally
npm link
```

Once linked, you can just run:

```bash
gnews
```

---

## Command Usage

```text
Usage:
  node index.js [options]

Options:
  -s, --search <query>   Search Google News for specific keywords
  -t, --topic <topic>     Filter headlines by topic:
                          world, nation, business, technology, entertainment, sports, science, health
  -l, --limit <number>    Limit the number of headlines shown (default: 10)
  -h, --help              Show help menu
```

### Examples

**Fetch standard top headlines:**
```bash
node index.js
```

**Fetch Tech headlines (limit to 5 articles):**
```bash
node index.js --topic technology --limit 5
```

**Search for specific topics:**
```bash
node index.js --search "quantum computing"
```
