#!/usr/bin/env node

const path = require('path');
const os = require('os');
const cp = require('child_process');
const fs = require('fs');

process.chdir(path.resolve(__dirname, '..'));

const statusJsonFilePath = './.changeset/status.json';

cp.execSync('changeset status --output ' + statusJsonFilePath);

const statusJson = JSON.parse(fs.readFileSync(statusJsonFilePath));
fs.rmSync(statusJsonFilePath);

const changesets = statusJson.changesets;


const title = `## ${new Date().toISOString().replace(/T.+$/, '')}\n`;

const releasesDetail =
`
| Package | Released Version | Released Type |
|---------|------------------|---------------|
${
  statusJson.releases.map((release) => {
    return `| \`${release.name}\` | \`${release.newVersion} \` | ${release.type} |\n`
  }).join('')
}
`



const changeDetail = changesets.reduce((changelog, changeset) => {

  const summary = changeset.summary.split('\n').map((line) => {
    return '  ' + line
  }).join('\n');
  const changeSummary = '- **Summary**: \n\n' + summary + '\n\n';

  const majorChangesTo = changeset.releases.filter(affected => affected.type === 'major').map(affected => `\`${affected.name}\``).sort();
  const minorChangesTo = changeset.releases.filter(affected => affected.type === 'minor').map(affected => `\`${affected.name}\``).sort();
  const patchChangesTo = changeset.releases.filter(affected => affected.type === 'patch').map(affected => `\`${affected.name}\``).sort();

  const majorAffectedPackages = majorChangesTo.length > 0
    ? '   - Major changes: \n' + majorChangesTo.map(change => '     - ' + change).join('\n') + '\n'
    : '';
  const minorAffectedPackages= minorChangesTo.length > 0
    ? '   - Major changes: \n' + minorChangesTo.map(change => '     - ' + change).join('\n') + '\n'
    : '';
  const patchAffectedPackages = patchChangesTo.length > 0
    ? '   - Patch changes: \n' + patchChangesTo.map(change => '     - ' + change).join('\n') + '\n'
    : '';

  const affectedPackages =  (majorAffectedPackages.length > 0 || minorAffectedPackages.length > 0 || patchAffectedPackages.length > 0)
    ? '  **Affected packages**: \n' +
      majorAffectedPackages +
      minorAffectedPackages +
      patchAffectedPackages
    : '';

  return changelog + changeSummary + affectedPackages;

}, '');

let changeLog = `
## ${new Date().toISOString().replace(/T.+$/, '')}\n

### Releases

${releasesDetail}

### Notable Changes

${changeDetail}

`
const prereleaseChangeLogFilePath =path.join(__dirname, '..', 'CHANGELOG-PRERELEASE.md')
const releaseChangeLogFilePath = path.join(__dirname, '..', 'CHANGELOG.md');;


const changeLogFilePath = statusJson.preState
  ? prereleaseChangeLogFilePath
  : releaseChangeLogFilePath

if (!statusJson.preState) {
  fs.rmSync(prereleaseChangeLogFilePath, {force: true});
}

let oldChangeLog
try {
  oldChangeLog = fs.readFileSync(changeLogFilePath, 'utf-8');
} catch(_) {
  oldChangeLog = ''
}

changeLog += oldChangeLog

fs.writeFileSync(changeLogFilePath, changeLog, 'utf-8');







