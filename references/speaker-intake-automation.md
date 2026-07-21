# Speaker intake automation

Use this integration when speakers should receive one link and the organizer should not move files or rename uploads. The organizer can ask Codex to process the queue immediately, or rely on the scheduled fallback.

## Architecture

1. Deploy `google_apps_script/Code.gs`, `Index.html`, and `appsscript.json` as one Google Apps Script web app.
2. Run `setupAutomation` once. It creates a private Drive folder containing:
   - a private submission spreadsheet;
   - a private profile-picture folder;
   - a private generated-thumbnail folder;
   - a random bridge token in Script Properties.
3. Share only the web app `/exec` URL with speakers. Do not share the Drive folder or spreadsheet.
4. After a submission, let the thumbnail skill dispatch the queue workflow from an authenticated GitHub CLI session.
5. Keep `.github/workflows/process-speaker-intake.yml` polling every five minutes as a fallback.
6. Let the worker return exact 1280x720 PNGs through the token-protected bridge. The Apps Script saves them to the private output folder and writes the Drive link to the submission row.

## Queue a submission manually

From an authenticated organizer machine, run:

```bash
scripts/dispatch_intake_queue.sh
```

The helper prints the GitHub Actions URL, waits for the run, and reports whether it completed a thumbnail job or found an empty queue. It processes up to three queued submissions per run. This is the recommended path when the organizer is already working with Codex: no additional GitHub credential is stored in Apps Script, and a typical warm run finishes in tens of seconds.

Tell Codex “process the speaker intake queue” after someone submits. The skill should dispatch the helper, monitor it, and direct the organizer to the private Generated Thumbnails folder.

## Deploy the Google web app

1. Create a standalone Apps Script project at `script.google.com`.
2. Replace `Code.gs` with the bundled source, add an HTML file named `Index`, and paste `Index.html` into it.
3. Enable the manifest in Project Settings and replace it with `appsscript.json` when using `clasp`; otherwise keep the default V8 manifest.
4. Run `setupAutomation` from the editor and approve the requested Spreadsheet and Drive permissions.
5. Deploy a new **Web app** version:
   - execute as the project owner;
   - allow access to **Anyone**;
   - use the resulting `/exec` URL as both the public intake URL and the bridge URL.
6. Run `logBridgeConfiguration` and read its execution log. Treat the printed bridge token as a secret.

## Optional: configure automatic immediate triggering

1. Create a fine-grained GitHub personal access token restricted to `msaroufim/render-gpu-mode-thumbnails`.
2. Grant only **Actions: Read and write**, which GitHub requires for the workflow-dispatch endpoint.
3. In Apps Script **Project Settings → Script Properties**, create `GITHUB_TRIGGER_TOKEN` with that token as its value.
4. Run `setupAutomation` again so these non-secret properties are present:
   - `GITHUB_REPOSITORY=msaroufim/render-gpu-mode-thumbnails`
   - `GITHUB_WORKFLOW=process-speaker-intake.yml`
   - `GITHUB_REF=main`
5. Redeploy the web app after changing Apps Script source. Never place the GitHub token in GitHub, source files, logs, URLs, or the public HTML page.

This token is not required for the manual skill workflow. The automatic trigger is best-effort: a failed GitHub request does not reject the speaker's submission, and the row remains `QUEUED` for the manual skill or five-minute scheduled fallback.

## Configure GitHub

Create these repository Actions secrets:

- `GOOGLE_APPS_SCRIPT_URL`: the deployed `/exec` URL.
- `GOOGLE_APPS_SCRIPT_TOKEN`: the bridge token logged by Apps Script.

Run the **Process speaker intake thumbnail queue** workflow manually once. A healthy empty queue prints `No queued thumbnail submissions`.

The workflow file must be merged into the default branch before GitHub will accept API workflow-dispatch runs.

## Intake and privacy rules

- The public page accepts one required speaker and up to two optional co-speakers.
- Resize images in the responder's browser to at most 1200 pixels on the long edge before upload.
- Reject unsupported photo formats promptly and restore the form after client preparation or upload timeouts.
- Store source photos and generated thumbnails privately in Drive; never commit or upload them as GitHub artifacts.
- Require public-use consent before accepting a submission.
- Expose no read endpoint without the bridge token.
- Keep the GitHub workflow limited to `contents: read` and triggers that do not expose secrets to pull requests.

## Operations

- Inspect the private Sheet for `QUEUED`, `PROCESSING`, `COMPLETE`, or `FAILED` status.
- Set a failed row back to `QUEUED` to retry after correcting its data.
- Treat a `PROCESSING` lease older than 20 minutes as abandoned; the bridge automatically requeues it.
- Deploy a new web-app version after changing Apps Script source. Updating the GitHub worker alone does not require redeploying Apps Script.
