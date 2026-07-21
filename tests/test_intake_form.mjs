import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("google_apps_script/Index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

assert.ok(scriptMatch, "intake page must contain client JavaScript");
new Function(scriptMatch[1]);
assert.ok(html.includes("Preparing photo ${index + 1} of ${sections.length}"));
assert.ok(html.includes("Uploading submission…"));
assert.ok(html.includes("PHOTO_TIMEOUT_MS"));
assert.ok(html.includes("SUBMISSION_TIMEOUT_MS"));
assert.ok(html.includes("canvas.toBlob"));
assert.ok(html.includes("setBusy(false)"));
assert.ok(html.includes("your form entries are still here"));
assert.ok(!html.includes('class="brand"'));
assert.ok(!html.includes("brand-dot"));

console.log("Speaker intake client checks passed");
