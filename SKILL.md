---
name: render-gpu-mode-thumbnails
description: Render exact 1280x720 GPU MODE YouTube thumbnails from a title, optional subtitle or URL, and one to three speaker names and headshots. Use when Codex needs to reproduce the white GPU MODE speaker-thumbnail layout, swap speakers or episode titles, process the private Google-hosted speaker-intake queue, retain the official GPU MODE logo, or deliver a Canva- and YouTube-ready PNG.
---

# Render GPU MODE Thumbnails

Create thumbnails with the bundled deterministic renderer. Preserve the white background, centered bold title, square speaker portraits, bold names, and official GPU MODE logo.

## Choose the workflow

- For one local thumbnail, use `scripts/render_thumbnail.py` with an explicit JSON request.
- For hands-off speaker submissions, use `scripts/process_intake_job.py` with the Google-hosted intake bridge. Read [references/speaker-intake-automation.md](references/speaker-intake-automation.md) before deploying or changing that integration.

## Render one thumbnail

1. Confirm the title, optional subtitle or URL, speaker order, name-to-photo mapping, and output path.
2. Create a temporary JSON request with this shape:

```json
{
  "title": "Episode title",
  "subtitle": "optional.example",
  "speakers": [
    {"name": "First Speaker", "photo": "/absolute/path/first.jpg"},
    {"name": "Second Speaker", "photo": "/absolute/path/second.png"}
  ]
}
```

3. Run `scripts/render_thumbnail.py --config REQUEST.json --output OUTPUT.png` with a Python runtime that provides Pillow. In Codex desktop, call `load_workspace_dependencies` and use its bundled Python path.
4. Verify the output is exactly 1280 by 720 pixels. Inspect it visually and rerun after adjusting optional `focal_x` or `focal_y` values between `0.0` and `1.0` when a face needs different cropping.
5. Return the PNG inline and as a clickable local-file link.

## Process the intake queue

Run `scripts/process_intake_job.py --max-jobs 3` with `GOOGLE_APPS_SCRIPT_URL` and `GOOGLE_APPS_SCRIPT_TOKEN` set. In production, let Apps Script dispatch the GitHub workflow immediately and retain the five-minute schedule as a fallback. Never print the bridge token, GitHub trigger token, image payloads, or private submission contents.

## Rules

- Accept one to three speakers only.
- Preserve the speaker order in the request.
- Never infer which photo belongs to which name when the mapping is ambiguous.
- Keep generated thumbnails and personal headshots outside the repository and skill directory.
- Use absolute paths for local photos and output files.
- Keep the final deliverable at exactly 1280x720; do not upscale a completed image after rendering.
- Use `--font /absolute/path/font.ttf` only when the user requests a particular typeface. Otherwise let the renderer choose a bold sans-serif system font.
- Keep the public intake link separate from the private bridge token. Store the token only in Apps Script properties and GitHub Actions secrets.

## Resources

- `scripts/render_thumbnail.py`: Validate a local request, fit text, crop portraits, place the logo, and write the final PNG.
- `scripts/process_intake_job.py`: Claim private intake jobs, render them, and return thumbnails to Drive.
- `google_apps_script/`: Source for the one-link intake page and private Drive/Sheet bridge.
- `assets/gpu-mode-logo-black.png`: Trimmed raster version used by the renderer.
- `assets/gpu-mode-logo-black.svg`: Original official source asset supplied by GPU MODE.
