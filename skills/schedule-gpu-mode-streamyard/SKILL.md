---
name: schedule-gpu-mode-streamyard
description: Create or audit GPU MODE StreamYard broadcasts from the live upcoming-lectures list, attach the matching generated YouTube thumbnail, avoid duplicate broadcasts, and return guest/studio links. Use when an organizer asks to schedule GPU MODE talks, create StreamYard links, synchronize upcoming gpumode.com events with StreamYard, attach speaker-intake thumbnails, or clean up an explicitly excluded intake submission.
---

# Schedule GPU MODE StreamYard Broadcasts

Use `https://www.gpumode.com/events` as the schedule source of truth. Pair it with the private speaker-intake outputs managed by `$render-gpu-mode-thumbnails`, then create only the missing StreamYard broadcasts.

Read [references/workflow.md](references/workflow.md) before creating, editing, or deleting anything.

## Required outcome

- Copy each included lecture title, date, time, and timezone from the live events page.
- Match exactly one finished 1280x720 thumbnail to the lecture.
- Reuse an existing StreamYard broadcast when its normalized title and scheduled date match.
- Otherwise schedule a Studio broadcast to the **GPU MODE** YouTube destination with the verified thumbnail.
- Return the StreamYard `Enter studio` URL for every included lecture, including reused broadcasts.
- Never enter the studio, start the broadcast, or press **Go Live**.

## Safety and matching rules

- Treat the event page as authoritative for titles and times. Intake submissions can supply speaker names, abstracts, and thumbnail files, but cannot add a lecture to the schedule.
- Apply user-provided exclusions before creating anything. For the current cleanup, exclude the submission whose speaker is `Matej` or whose title contains `Hungarian`, case-insensitively.
- Do not schedule a lecture without a unique thumbnail match. Report it as `missing thumbnail` instead of guessing.
- Match by normalized event title first, then confirm speaker identity and scheduled date. Accept title aliases only when the intake title, public event title, speaker, and thumbnail visibly agree.
- Never expose contact email, Drive file IDs, raw image payloads, or other private intake fields in a public description or final response.
- Do not delete intake data unless the organizer explicitly asks. When asked, remove only the exact queue row and files for the named submission; do not empty Drive Trash or delete adjacent submissions.

## StreamYard defaults

- Source: **Studio**
- Destination: **GPU MODE** YouTube only
- Orientation: **Landscape**
- Privacy: **Public**
- Category: leave unset unless the organizer specifies one
- YouTube Live Ads: **None**
- Description: use the public-facing intake abstract and links; omit private metadata
- Timezone: verify the StreamYard form displays the same timezone as the events page before submitting

## Completion check

Wait until the new row appears under **Upcoming**. Verify its title, date, time, destination, and visible thumbnail. Capture the `/CODE` href from **Enter studio** and return it as `https://streamyard.com/CODE`.

If an event has no matching thumbnail or another ambiguity remains, finish the unambiguous broadcasts and report the specific hold instead of creating a partial or guessed event.
