---
name: finalize-gpu-mode-youtube-video
description: Convert a completed GPU MODE YouTube livestream into a normal Videos item by making a minimal content-neutral edit, saving a new copy, verifying it, and restoring the intended thumbnail. Use only after a GPU MODE stream has ended; do not use for live or upcoming broadcasts.
---

# Finalize a GPU MODE YouTube Video

Preserve a completed GPU MODE talk as a normal YouTube video while leaving the original live replay intact.

Before changing YouTube, read [references/workflow.md](references/workflow.md) and use a signed-in browser session for YouTube Studio.

## Required inputs

- Identify the completed stream uniquely by YouTube URL or by exact title plus broadcast date.
- Resolve the intended thumbnail to one confirmed local image file. Prefer the thumbnail used for the corresponding StreamYard broadcast.
- If either mapping is ambiguous, stop and ask rather than choosing a likely candidate.

## Required outcome

- The original live replay remains unedited and undeleted under **Content → Live**.
- Exactly one new copy appears under **Content → Videos** with a distinct YouTube video ID.
- The copy preserves the intended title, description, visibility, audience setting, and other metadata unless the user requests a change.
- The intended thumbnail is uploaded to the new copy and visibly confirmed in YouTube Studio.
- Return both the original replay URL and the new video URL, plus the final visibility and processing status.

## Guardrails

- Use **Save as new** or a clearly equivalent control that creates a separate video. Never use ordinary **Save** if it would alter the live replay.
- Make only the smallest verified content-neutral trim, normally one or two seconds of silent padding after the talk has ended. Preview the boundary first; never remove speech or useful visual content.
- Submit creation once. If YouTube times out or reports processing, inspect **Content → Videos** before retrying so a second copy is not created.
- Do not delete, hide, overwrite, or otherwise modify the original live replay. Any cleanup of the original is a separate task requiring an explicit request.
- Immediately before creating the copy and uploading its thumbnail, obtain action-time confirmation that names the source stream, minimal edit, resulting visibility, and thumbnail file. One confirmation may cover the well-defined save and thumbnail upload.
- If **Save as new** is unavailable, the replay is still processing, no safe trim exists, or the new copy cannot be identified uniquely, stop and report the hold. Do not substitute a destructive in-place edit or a download/re-upload workflow.
