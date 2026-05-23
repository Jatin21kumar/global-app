# Global App

A lightweight interactive globe and country viewer built with plain HTML, CSS, and JavaScript.

## Features
- Interactive globe visualization
- Country data and images (local assets in `images/` and `data/`)
- Configurable behavior via `config.js`

## Project structure

- `index.html` — main page
- `script.js` — application logic
- `config.js` — configuration options
- `countries.geo.json` — geographic data
- `data/` — supporting JSON datasets
- `images/` — local country and continent images

## Getting started

Prerequisites: a modern browser.

To run locally (recommended to use a simple static server):

Windows / macOS / Linux (Python 3):

```bash
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

Or open `index.html` directly in your browser, though some features may require a local server.

## Configuration
Edit `config.js` to change zoom limits, default country, or other behavior.

## Data sources
This repository includes local copies of geographic datasets and image assets under `data/` and `images/`.

## Contributing
If you'd like to contribute, please open an issue or submit a pull request with a clear description of changes.

## License
This project is provided under the MIT License — see `LICENSE` (if added) for details.

---

If you want, I can also add a `LICENSE` file, usage screenshots, or run tests. Tell me which.
