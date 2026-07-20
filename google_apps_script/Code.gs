const INTAKE = Object.freeze({
  sheetName: "Submissions",
  leaseMinutes: 20,
  maxImageBytes: 5 * 1024 * 1024,
  headers: Object.freeze([
    "Submitted at",
    "Contact email",
    "Talk title",
    "Abstract",
    "Thumbnail subtitle or URL",
    "Speaker 1 name",
    "Speaker 1 photo file ID",
    "Speaker 1 photo filename",
    "Speaker 1 photo MIME type",
    "Speaker 2 name",
    "Speaker 2 photo file ID",
    "Speaker 2 photo filename",
    "Speaker 2 photo MIME type",
    "Speaker 3 name",
    "Speaker 3 photo file ID",
    "Speaker 3 photo filename",
    "Speaker 3 photo MIME type",
    "Public-use consent",
    "Automation status",
    "Automation job ID",
    "Automation claimed at",
    "Thumbnail URL",
    "Automation error",
    "Automation processed at",
  ]),
});


function setupAutomation() {
  const properties = PropertiesService.getScriptProperties();
  let rootFolderId = properties.getProperty("ROOT_FOLDER_ID");
  let spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  let inboxFolderId = properties.getProperty("INBOX_FOLDER_ID");
  let outputFolderId = properties.getProperty("OUTPUT_FOLDER_ID");

  if (!rootFolderId) {
    rootFolderId = DriveApp.createFolder("GPU MODE Speaker Intake").getId();
  }
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create("GPU MODE Speaker Submissions");
    spreadsheetId = spreadsheet.getId();
    DriveApp.getFileById(spreadsheetId).moveTo(rootFolder);
  }
  if (!inboxFolderId) {
    inboxFolderId = rootFolder.createFolder("Private Profile Pictures").getId();
  }
  if (!outputFolderId) {
    outputFolderId = rootFolder.createFolder("Generated Thumbnails").getId();
  }

  const sheet = getOrCreateSubmissionSheet_(spreadsheetId);
  ensureHeaders_(sheet);
  let token = properties.getProperty("BRIDGE_TOKEN");
  if (!token) {
    token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  }
  properties.setProperties({
    ROOT_FOLDER_ID: rootFolderId,
    SPREADSHEET_ID: spreadsheetId,
    SHEET_NAME: sheet.getName(),
    INBOX_FOLDER_ID: inboxFolderId,
    OUTPUT_FOLDER_ID: outputFolderId,
    BRIDGE_TOKEN: token,
  });
  console.log("GPU MODE intake resources are ready. Run logBridgeConfiguration after deployment.");
}


function logBridgeConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const configuration = {
    intake_and_bridge_url: ScriptApp.getService().getUrl() || "Deploy as a web app first",
    bridge_token: properties.getProperty("BRIDGE_TOKEN") || "Run setupAutomation first",
    drive_folder_url: properties.getProperty("ROOT_FOLDER_ID")
      ? "https://drive.google.com/drive/folders/" + properties.getProperty("ROOT_FOLDER_ID")
      : "Run setupAutomation first",
    spreadsheet_url: properties.getProperty("SPREADSHEET_ID")
      ? "https://docs.google.com/spreadsheets/d/" + properties.getProperty("SPREADSHEET_ID") + "/edit"
      : "Run setupAutomation first",
  };
  console.log(JSON.stringify(configuration));
}


function doGet(event) {
  const action = event && event.parameter ? event.parameter.action : "";
  if (!action) {
    return HtmlService.createTemplateFromFile("Index")
      .evaluate()
      .setTitle("GPU MODE Speaker Intake")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
  try {
    authorizeBridge_(event.parameter.token || "");
    if (action === "health") {
      return jsonResponse_({status: "ok"});
    }
    if (action === "next") {
      return jsonResponse_(claimNextJob_());
    }
    throw new Error("Unsupported GET action: " + action);
  } catch (error) {
    return jsonResponse_({status: "error", error: safeError_(error)});
  }
}


function doPost(event) {
  try {
    const payload = JSON.parse(event && event.postData ? event.postData.contents : "{}");
    authorizeBridge_(payload.token || "");
    if (payload.action === "complete") {
      return jsonResponse_(completeJob_(payload));
    }
    if (payload.action === "fail") {
      return jsonResponse_(failJob_(payload));
    }
    throw new Error("Unsupported POST action.");
  } catch (error) {
    return jsonResponse_({status: "error", error: safeError_(error)});
  }
}


function submitTalk(payload) {
  validateSubmission_(payload);
  if (String(payload.company_website || "").trim()) {
    throw new Error("Submission rejected.");
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  const createdFiles = [];
  try {
    const resources = configuredResources_();
    const inbox = DriveApp.getFolderById(resources.inboxFolderId);
    const sheet = getSubmissionSheet_();
    const jobId = Utilities.getUuid();
    const speakerValues = [];
    payload.speakers.forEach(function (speaker, index) {
      const saved = saveProfilePicture_(inbox, speaker, index + 1, jobId);
      createdFiles.push(saved.file);
      speakerValues.push([
        sheetSafeText_(speaker.name, 120),
        saved.file.getId(),
        saved.file.getName(),
        saved.mimeType,
      ]);
    });
    while (speakerValues.length < 3) {
      speakerValues.push(["", "", "", ""]);
    }
    const row = [
      new Date(),
      sheetSafeText_(payload.contact_email, 254),
      sheetSafeText_(payload.title, 180),
      sheetSafeText_(payload.abstract, 5000),
      sheetSafeText_(payload.subtitle || "", 160),
    ];
    speakerValues.forEach(function (speakerRow) {
      Array.prototype.push.apply(row, speakerRow);
    });
    Array.prototype.push.apply(row, [
      "Confirmed",
      "QUEUED",
      jobId,
      "",
      "",
      "",
      "",
    ]);
    sheet.appendRow(row);
    return {status: "ok", submission_id: jobId};
  } catch (error) {
    createdFiles.forEach(function (file) {
      try {
        file.setTrashed(true);
      } catch (cleanupError) {
        console.error(cleanupError);
      }
    });
    throw error;
  } finally {
    lock.releaseLock();
  }
}


function claimNextJob_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSubmissionSheet_();
    const headers = headerMap_(sheet);
    for (let row = 2; row <= sheet.getLastRow(); row += 1) {
      let status = cellText_(sheet, row, headers["Automation status"]);
      if (status === "PROCESSING" && leaseExpired_(sheet, row, headers)) {
        status = "QUEUED";
        setCell_(sheet, row, headers["Automation status"], status);
      }
      if (status !== "QUEUED") {
        continue;
      }
      try {
        const job = buildJob_(sheet, row, headers);
        setCell_(sheet, row, headers["Automation status"], "PROCESSING");
        setCell_(sheet, row, headers["Automation claimed at"], new Date());
        setCell_(sheet, row, headers["Automation error"], "");
        SpreadsheetApp.flush();
        return {status: "job", job: job};
      } catch (error) {
        setCell_(sheet, row, headers["Automation status"], "FAILED");
        setCell_(sheet, row, headers["Automation error"], safeError_(error));
        setCell_(sheet, row, headers["Automation processed at"], new Date());
      }
    }
    return {status: "empty"};
  } finally {
    lock.releaseLock();
  }
}


function buildJob_(sheet, row, headers) {
  const speakers = [];
  for (let index = 1; index <= 3; index += 1) {
    const name = cellText_(sheet, row, headers["Speaker " + index + " name"]);
    const fileId = cellText_(sheet, row, headers["Speaker " + index + " photo file ID"]);
    if (!name && !fileId) {
      continue;
    }
    if (!name || !fileId) {
      throw new Error("Speaker " + index + " is missing a name or profile picture.");
    }
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > INTAKE.maxImageBytes) {
      throw new Error(file.getName() + " exceeds the 5 MB queue limit.");
    }
    speakers.push({
      name: name,
      filename: file.getName(),
      mime_type: blob.getContentType(),
      photo_base64: Utilities.base64Encode(bytes),
    });
  }
  if (speakers.length < 1 || speakers.length > 3) {
    throw new Error("A job must contain one to three speakers.");
  }
  return {
    job_id: requiredCellText_(sheet, row, headers, "Automation job ID"),
    row_number: row,
    title: requiredCellText_(sheet, row, headers, "Talk title"),
    abstract: requiredCellText_(sheet, row, headers, "Abstract"),
    subtitle: cellText_(sheet, row, headers["Thumbnail subtitle or URL"]),
    contact_email: requiredCellText_(sheet, row, headers, "Contact email"),
    speakers: speakers,
  };
}


function completeJob_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSubmissionSheet_();
    const headers = headerMap_(sheet);
    const row = validateJobIdentity_(sheet, headers, payload);
    if (cellText_(sheet, row, headers["Automation status"]) === "COMPLETE") {
      return {
        status: "ok",
        thumbnail_url: cellText_(sheet, row, headers["Thumbnail URL"]),
      };
    }
    if (!payload.thumbnail_base64) {
      throw new Error("Completion payload has no thumbnail data.");
    }
    const resources = configuredResources_();
    const folder = DriveApp.getFolderById(resources.outputFolderId);
    const bytes = Utilities.base64Decode(payload.thumbnail_base64);
    const filename = sanitizeFilename_(payload.filename || "gpu-mode-thumbnail.png");
    const file = folder.createFile(Utilities.newBlob(bytes, "image/png", filename));
    setCell_(sheet, row, headers["Automation status"], "COMPLETE");
    setCell_(sheet, row, headers["Thumbnail URL"], file.getUrl());
    setCell_(sheet, row, headers["Automation error"], "");
    setCell_(sheet, row, headers["Automation claimed at"], "");
    setCell_(sheet, row, headers["Automation processed at"], new Date());
    return {status: "ok", thumbnail_url: file.getUrl()};
  } finally {
    lock.releaseLock();
  }
}


function failJob_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSubmissionSheet_();
    const headers = headerMap_(sheet);
    const row = validateJobIdentity_(sheet, headers, payload);
    if (cellText_(sheet, row, headers["Automation status"]) !== "COMPLETE") {
      setCell_(sheet, row, headers["Automation status"], "FAILED");
      setCell_(sheet, row, headers["Automation error"], String(payload.error || "Unknown worker error").slice(0, 1500));
      setCell_(sheet, row, headers["Automation claimed at"], "");
      setCell_(sheet, row, headers["Automation processed at"], new Date());
    }
    return {status: "ok"};
  } finally {
    lock.releaseLock();
  }
}


function validateSubmission_(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Submission payload is missing.");
  }
  const email = cleanText_(payload.contact_email, 254);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid contact email.");
  }
  if (!cleanText_(payload.title, 180)) {
    throw new Error("Talk title is required.");
  }
  if (!cleanText_(payload.abstract, 5000)) {
    throw new Error("Abstract is required.");
  }
  if (payload.consent !== true) {
    throw new Error("Public-use consent is required.");
  }
  if (!Array.isArray(payload.speakers) || payload.speakers.length < 1 || payload.speakers.length > 3) {
    throw new Error("Provide one to three speakers.");
  }
  payload.speakers.forEach(function (speaker, index) {
    if (!speaker || !cleanText_(speaker.name, 120)) {
      throw new Error("Speaker " + (index + 1) + " name is required.");
    }
    if (!speaker.photo_base64 || !speaker.mime_type || !speaker.filename) {
      throw new Error("Speaker " + (index + 1) + " profile picture is required.");
    }
  });
}


function saveProfilePicture_(folder, speaker, speakerNumber, jobId) {
  const contentType = String(speaker.mime_type || "").toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].indexOf(contentType) === -1) {
    throw new Error("Profile pictures must be JPEG, PNG, or WebP images.");
  }
  let encoded = String(speaker.photo_base64 || "");
  if (encoded.indexOf(",") !== -1) {
    encoded = encoded.split(",").pop();
  }
  const bytes = Utilities.base64Decode(encoded);
  if (!bytes.length || bytes.length > INTAKE.maxImageBytes) {
    throw new Error("Profile pictures must be smaller than 5 MB after resizing.");
  }
  const extension = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
  const baseName = sanitizeFilename_(speaker.name || "speaker-" + speakerNumber).replace(/\.png$/i, "");
  const filename = jobId + "-speaker-" + speakerNumber + "-" + baseName + extension;
  const blob = Utilities.newBlob(bytes, contentType, filename);
  return {file: folder.createFile(blob), mimeType: contentType};
}


function validateJobIdentity_(sheet, headers, payload) {
  const row = Number(payload.row_number);
  if (!Number.isInteger(row) || row < 2 || row > sheet.getLastRow()) {
    throw new Error("Invalid response row number.");
  }
  const expectedJobId = cellText_(sheet, row, headers["Automation job ID"]);
  if (!expectedJobId || expectedJobId !== String(payload.job_id || "")) {
    throw new Error("Job ID does not match the response row.");
  }
  return row;
}


function leaseExpired_(sheet, row, headers) {
  const claimed = sheet.getRange(row, headers["Automation claimed at"]).getValue();
  return !(claimed instanceof Date) ||
    Date.now() - claimed.getTime() > INTAKE.leaseMinutes * 60 * 1000;
}


function authorizeBridge_(providedToken) {
  const expected = PropertiesService.getScriptProperties().getProperty("BRIDGE_TOKEN");
  if (!expected || providedToken !== expected) {
    throw new Error("Unauthorized bridge request.");
  }
}


function configuredResources_() {
  const properties = PropertiesService.getScriptProperties();
  const resources = {
    spreadsheetId: properties.getProperty("SPREADSHEET_ID"),
    inboxFolderId: properties.getProperty("INBOX_FOLDER_ID"),
    outputFolderId: properties.getProperty("OUTPUT_FOLDER_ID"),
  };
  if (!resources.spreadsheetId || !resources.inboxFolderId || !resources.outputFolderId) {
    throw new Error("Run setupAutomation before using the intake page.");
  }
  return resources;
}


function getOrCreateSubmissionSheet_(spreadsheetId) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(INTAKE.sheetName);
  if (!sheet) {
    const sheets = spreadsheet.getSheets();
    sheet = sheets.length === 1 && sheetIsEmpty_(sheets[0])
      ? sheets[0].setName(INTAKE.sheetName)
      : spreadsheet.insertSheet(INTAKE.sheetName);
  }
  return sheet;
}


function getSubmissionSheet_() {
  const resources = configuredResources_();
  const sheetName = PropertiesService.getScriptProperties().getProperty("SHEET_NAME") || INTAKE.sheetName;
  const sheet = SpreadsheetApp.openById(resources.spreadsheetId).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("The submissions sheet no longer exists.");
  }
  ensureHeaders_(sheet);
  return sheet;
}


function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheetIsEmpty_(sheet)) {
    sheet.getRange(1, 1, 1, INTAKE.headers.length).setValues([INTAKE.headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, INTAKE.headers.length).setFontWeight("bold");
    return;
  }
  const actual = sheet.getRange(1, 1, 1, INTAKE.headers.length).getDisplayValues()[0];
  INTAKE.headers.forEach(function (expected, index) {
    if (actual[index] !== expected) {
      throw new Error("Submissions sheet header mismatch at column " + (index + 1) + ".");
    }
  });
}


function sheetIsEmpty_(sheet) {
  return sheet.getLastRow() === 0 ||
    (sheet.getLastRow() === 1 && sheet.getLastColumn() === 1 && !sheet.getRange(1, 1).getValue());
}


function headerMap_(sheet) {
  const values = sheet.getRange(1, 1, 1, INTAKE.headers.length).getDisplayValues()[0];
  const map = {};
  values.forEach(function (value, index) {
    map[value] = index + 1;
  });
  return map;
}


function requiredCellText_(sheet, row, headers, header) {
  const value = cellText_(sheet, row, headers[header]);
  if (!value) {
    throw new Error("Missing queued value: " + header);
  }
  return value;
}


function cellText_(sheet, row, column) {
  return String(sheet.getRange(row, column).getDisplayValue() || "").trim();
}


function setCell_(sheet, row, column, value) {
  sheet.getRange(row, column).setValue(value);
}


function cleanText_(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}


function sheetSafeText_(value, maxLength) {
  const text = cleanText_(value, maxLength);
  return /^[=+@-]/.test(text) ? "'" + text : text;
}


function sanitizeFilename_(value) {
  const cleaned = String(value).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "gpu-mode-thumbnail.png").replace(/\.(?!png$)[^.]+$/i, ".png");
}


function safeError_(error) {
  return String(error && error.message ? error.message : error).slice(0, 1500);
}


function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
