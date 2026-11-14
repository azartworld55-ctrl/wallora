# Wallora

**Your workspace. Your atmosphere.**

Wallora is a free, open-source wallpaper plugin for [Obsidian](https://obsidian.md/). Build a personal gallery from your own images, customize how your background looks, and let it change automatically.

## Features

- Add images from your device to your vault's `Wallora/` folder.
- Browse your personal wallpaper gallery with previews.
- Set, replace, and remove wallpapers.
- Tune overlay darkness, image opacity, blur, fit, and position.
- Shuffle to a random wallpaper.
- Automatically rotate wallpapers on a configurable interval.
- Quick commands, ribbon button, and settings tab.
- All images stay in your vault. No account, server, analytics, or network access.

## Install

### Community plugins

Once Wallora is approved and listed in the Obsidian Community Plugins directory:

1. Open **Settings → Community plugins → Browse**.
2. Search for **Wallora**.
3. Install and enable it.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create `.obsidian/plugins/wallora/` in your vault.
3. Copy those three files into that folder.
4. Reload Obsidian and enable **Wallora** in Community plugins.

## Usage

- Click the image icon in the ribbon or run **Wallora: Open wallpaper gallery**.
- Choose **Add wallpapers** to import images from your device.
- Select a thumbnail to apply it.
- Use the Wallora settings tab to adjust appearance and rotation.

Imported images are copied into the vault's `Wallora/` folder. Removing an image from the gallery also removes its managed copy from that folder.

## Releases

Push a version tag such as `v1.0.0` to build the plugin and publish a GitHub Release containing `main.js`, `manifest.json`, and `styles.css`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions also builds the plugin on pushes and pull requests. The compiled bundle is available as a workflow artifact.

## Development

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Build a production bundle:

```bash
npm run build
```

The build output is `main.js`. Copy it together with `manifest.json` and `styles.css` into your vault's `.obsidian/plugins/wallora/` directory.

## Privacy

Wallora works locally. It does not make network requests, collect telemetry, or upload your images. Your wallpaper files remain in your vault.

## License

MIT. See [LICENSE](LICENSE).
