import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";


const source = fs.readFileSync(new URL("../google_apps_script/Code.gs", import.meta.url), "utf8");


function loadScript(properties, responseCode = 204, responseBody = "") {
  let request;
  const context = {
    console: {log() {}, warn() {}, error() {}},
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return properties[key] || null;
          },
        };
      },
    },
    UrlFetchApp: {
      fetch(url, options) {
        request = {url, options};
        return {
          getResponseCode() {
            return responseCode;
          },
          getContentText() {
            return responseBody;
          },
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {context, getRequest: () => request};
}


{
  const {context, getRequest} = loadScript({
    GITHUB_TRIGGER_TOKEN: "test-token",
    GITHUB_REPOSITORY: "msaroufim/render-gpu-mode-thumbnails",
    GITHUB_WORKFLOW: "process-speaker-intake.yml",
    GITHUB_REF: "main",
  });
  assert.equal(context.triggerGitHubWorker_("job-123"), true);
  const request = getRequest();
  assert.equal(
    request.url,
    "https://api.github.com/repos/msaroufim/render-gpu-mode-thumbnails/actions/workflows/" +
      "process-speaker-intake.yml/dispatches"
  );
  assert.equal(request.options.method, "post");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(request.options.payload), {
    ref: "main",
    inputs: {job_id: "job-123"},
  });
}


{
  const {context, getRequest} = loadScript({});
  assert.equal(context.triggerGitHubWorker_("job-queued"), false);
  assert.equal(getRequest(), undefined);
}


{
  const {context} = loadScript(
    {GITHUB_TRIGGER_TOKEN: "test-token"},
    403,
    "forbidden"
  );
  assert.throws(
    () => context.triggerGitHubWorker_("job-denied"),
    /GitHub workflow dispatch returned HTTP 403/
  );
}


console.log("Apps Script dispatch tests passed");
