# GPU MODE post-stream workflow

YouTube Studio changes over time. Use the visible labels and current page state rather than fixed coordinates or guessed URLs.

## 1. Resolve the source and thumbnail

1. Open YouTube Studio for the GPU MODE channel and go to **Content → Live**.
2. Find the completed replay by exact URL or by the combination of title and broadcast date. Confirm that it is no longer live and that archive processing has finished.
3. Record the original video ID, URL, title, description, visibility, audience setting, broadcast date, and duration for comparison. Do not change them.
4. Resolve one intended thumbnail file and visually inspect it. Prefer a 16:9 image already used for the matching StreamYard broadcast.

YouTube normally archives streams shorter than 12 hours, but archived streams remain grouped under the Live tab. See [Archive live streams](https://support.google.com/youtube/answer/6247592).

## 2. Check for an existing finalized copy

1. Go to **Content → Videos** (or the current equivalent for ordinary uploads).
2. Search the exact title and inspect plausible matches by creation date, duration, and thumbnail.
3. If a distinct copy already exists and has the intended thumbnail and metadata, return it as `reused`.
4. If candidates exist but cannot be distinguished confidently, stop. Do not create another copy.

## 3. Choose the minimal edit

1. Open the completed live replay's **Editor**.
2. Preview the last several seconds. Prefer trimming one or two seconds only when they are clearly post-talk silence, a frozen final frame, or encoder padding.
3. If the tail ends on meaningful speech or visuals, inspect the opening for equally harmless padding. Do not trim an intro card merely to manufacture a change.
4. Enter precise timestamps when the editor allows it, then preview the edited boundary.
5. If no content-neutral edit is available, stop and ask the user to choose the segment.

The normal YouTube trim action changes the existing video's media while retaining its URL. Saved Editor changes may be irreversible, so this workflow must use the separate-copy action instead. See [Trim your videos](https://support.google.com/youtube/answer/9057455) and [Preview and review changes](https://support.google.com/youtube/answer/16564646).

## 4. Confirm and create one copy

At action time, state all of the following and ask for confirmation:

- source title and original YouTube URL;
- exact trim boundary or duration;
- intended title and visibility of the new copy;
- exact thumbnail file that will be uploaded.

After confirmation:

1. Open the save menu and choose **Save as new** or an unambiguous equivalent that says it creates a new video.
2. Preserve the original metadata and visibility. If YouTube proposes a title such as `Copy of …`, restore the intended title before publishing when the dialog allows it.
3. Submit once and record any success message or processing state.
4. If submission appears to time out, check **Content → Videos** and processing status before taking any further action. Never click the creation action a second time without proving that no copy exists.

If the interface offers only an in-place **Save**, stop. Do not accept an acknowledgement that makes permanent changes to the original.

## 5. Restore the thumbnail

1. Locate the new item under **Content → Videos** and verify that its video ID differs from the live replay.
2. Open its details and upload the confirmed thumbnail through the visible thumbnail control.
3. Save the details once.
4. Return to **Content → Videos** and verify the thumbnail, title, visibility, and processing state on the new row.

## 6. Report

Return a compact result containing:

- `created`, `reused`, or `blocked`;
- original live replay URL;
- new ordinary-video URL, when available;
- edit applied;
- title, visibility, and processing status;
- thumbnail verification.

Never enter Live Control Room, start another stream, or remove the original replay as part of this skill.
