# GPU MODE scheduling workflow

## 1. Build the event manifest

1. Open `https://www.gpumode.com/events` and wait for the live Discord-backed **Upcoming Lectures** list to finish loading.
2. Record the public title, local date, local time, timezone label, description, and Discord event URL for each future lecture.
3. Ignore kernel competitions and archived lectures unless the organizer explicitly includes them.
4. Apply exclusions case-insensitively before any StreamYard changes. The current explicit exclusion is the Matej submission titled `my opinions on hungarians`.

## 2. Match thumbnails

1. Use the private **Generated Thumbnails** folder configured by `$render-gpu-mode-thumbnails`.
2. Prefer exact normalized-title matches. Strip punctuation, collapse whitespace, and compare lowercase text.
3. When titles differ, use the intake sheet only to validate an alias through speaker name, abstract, and thumbnail. Examples that have been validated once are:
   - `TIRx` -> `TIRx and Axe Layout` by Bohan Hou.
   - `The 4-bitter lesson: Balancing Stability and Performance in NVFP4 RL` -> `NVFP4 RL Recipe` by Ziang Li.
   - `One Layer Deeper` -> `One Layer Deeper Competition` by Sean McLeish and Ben Keigwin.
4. Visually inspect every selected PNG before uploading. Require a 1280x720 image and the expected GPU MODE layout.
5. If no unique image exists, mark the event `missing thumbnail` and do not create its broadcast.

## 3. Check StreamYard first

1. Open `https://streamyard.com/broadcasts`.
2. Read every **Upcoming** row before clicking **Live stream**.
3. Normalize title punctuation and capitalization, but require the same calendar date. Reuse a matching broadcast rather than creating a duplicate.
4. Record the existing **Enter studio** href and confirm its thumbnail visually.

## 4. Create a missing broadcast

1. Click **Live stream**.
2. Keep **Studio** selected.
3. Select only the **GPU MODE** YouTube destination.
4. Use the public event title verbatim, subject to StreamYard's 100-character limit. If the title is too long, preserve the distinguishing topic and report the shortened form.
5. Fill the description from the consented, public-facing intake abstract. Never include contact email or internal IDs.
6. Keep Landscape, Public, category unset, and YouTube Live Ads set to None.
7. Check **Schedule for later** and copy the event date and time. Confirm the timezone text beside the control matches the source page.
8. Upload the matched PNG and click **Apply** in the crop dialog. The input image is already 16:9, so retain the full frame.
9. Click **Create live stream** once. Wait until the modal closes and the new **Upcoming** row appears.

### StreamYard upload control

The visible **Upload thumbnail** control can be exposed as a `div`, even though the accessibility snapshot describes a button. If a normal role-based click is not actionable, inspect the current visible DOM, identify the exact `Upload thumbnail` node, and click that visible node while waiting for the file chooser. Set the chooser to the absolute PNG path, then apply the crop. Do not repeatedly retry a timed-out locator because the unsaved draft may be lost.

## 5. Verify and report

For each included lecture, verify:

- exact public title;
- scheduled date, time, and timezone;
- GPU MODE YouTube destination;
- correct visible thumbnail;
- a unique `Enter studio` href.

Return a compact table with lecture, schedule, result (`created`, `reused`, or `blocked`), and StreamYard URL. Mention that scheduled streams do not start automatically.

## Exact cleanup for an excluded submission

Run this only after an explicit deletion request.

1. Identify the queue row by both speaker and talk title.
2. Record its automation job ID and exact profile-photo and thumbnail filenames.
3. Move only those Drive files to Trash so they remain recoverable.
4. Delete only the exact spreadsheet row.
5. Export or re-read the queue and verify that neither the speaker nor title remains.
6. State what was removed and that Drive Trash remains recoverable. Never empty Drive Trash as part of this workflow.
