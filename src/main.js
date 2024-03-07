const github = require('@actions/github');
const axios = require('axios');
const core = require('@actions/core');

const colors = {
  success: '#2cbe4e',
  failure: '#ff0000',
  other: '#ffc107'
};

const events = {
  pull_request: 'pull_request',
  push: 'push',
  workflow_dispatch: 'workflow_dispatch'
};

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const name = core.getInput('name', { required: true });
    const url = core.getInput('url', { required: true });
    const status = core.getInput('status', { required: true });
    const collapseInput = core.getInput('collapse');
    const defaultCollapse = -1;
    let collapse;
    if (collapseInput == null || collapseInput === '') {
      collapse = defaultCollapse;
    } else {
      collapse = parseInt(collapseInput);
      if (isNaN(collapse)) {
        collapse = defaultCollapse;
      }
    }
    const artifactUrl = core.getInput('artifactUrl', { required: true });
    const boardName = core.getInput('boardName');
    const atlassianDomain = core.getInput('atlassianDomain');

    core.debug(`input params: name=${name}, status=${status}, url=${url}, collapse=${collapse}, artifactUrl=${artifactUrl}`);

    const ok = await sendNotification(name, url, status, collapse, artifactUrl, boardName, atlassianDomain);
    if (!ok) {
      core.setFailed('error sending notification to google chat');
    } else {
      core.debug(`Sent notification: ${name}, ${status}`);
    }
  } catch (e) {
    core.setFailed(`error sending notification to google chat: ${e}`);
  }
}

async function sendNotification(name, url, status, collapse, artifactUrl, boardName, atlassianDomain) {
  const { owner, repo } = github.context.repo;
  const { eventName, sha, ref, actor, workflow, runNumber } = github.context;
  const { number } = github.context.issue;

  const jiraIssueLink = createJiraLink(name, boardName, atlassianDomain);

  const card = createCard({ name, status, owner, repo, eventName, ref, actor, workflow, sha, number, collapse, artifactUrl, runNumber, jiraIssueLink });
  const body = createBody(name, card);

  try {
    const response = await axios.post(url, body);
    core.debug(`request success with status: ${response.status}`);
    return true;
  } catch (e) {
    core.debug(`request failed with error, body: ${JSON.stringify(body)}, response:${JSON.stringify(e.response?.data || '')}`);
    return false;
  }
}

function createCard({ name, status, owner, repo, eventName, ref, actor, workflow, sha, number, collapse, artifactUrl, runNumber, jiraIssueLink }) {
  const statusLower = status.toLowerCase();
  let statusColor;
  const statusName = status.substring(0, 1).toUpperCase() + status.substring(1);
  let statusType = statusLower;
  if (statusLower === 'success') {
    statusColor = colors.success;
  } else if (statusLower === 'failure') {
    statusColor = colors.failure;
  } else {
    // if (statusLower === 'cancelled') {
    statusColor = colors.other;
    statusType = 'cancelled';
  }

  const eventType = events[(eventName || '').toLowerCase()] || events.push;
  let eventNameFmt;
  if (eventType === events.pull_request) {
    eventNameFmt = 'Pull Request';
  } else if (eventType === events.push) {
    eventNameFmt = 'Push';
  } else {
    eventNameFmt = 'Workflow Dispatch';
  }

  const eventPath = eventType === events.pull_request ? `/pull/${number}` : `/commit/${sha}`;
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const eventUrl = `${repoUrl}${eventPath}`;
  const checksUrl = `${repoUrl}${eventPath}/checks`;
  const showNameWidget = name.length >= 45; // google chat truncates title header if too long
  const nameWidgets = [];
  if (showNameWidget) {
    nameWidgets.push({
      decoratedText: {
        topLabel: 'Name',
        text: name,
        wrapText: true
      }
    });
  }

  const jiraWidgets = [];
  if (jiraIssueLink) {
    jiraWidgets.push({
      decoratedText: {
        icon: { iconUrl: 'https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/jira.png' },
        topLabel: 'Jira issue',
        text: jiraIssueLink,
        button: { text: 'Open', onClick: { openLink: { url: jiraIssueLink } } }
      }
    });
  }
  return {
    header: {
      title: name,
      subtitle: `${owner}/${repo}`,
      imageUrl: 'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',
      imageType: 'CIRCLE'
    },
    sections: [
      {
        collapsible: collapse >= 0,
        uncollapsibleWidgetsCount: collapse,
        widgets: [
          {
            decoratedText: {
              icon: { iconUrl: `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/status_${statusType}.png` },
              topLabel: 'Status',
              text: `<font color="${statusColor}">${statusName}</font>`,
              button: { text: 'Open Checks', onClick: { openLink: { url: checksUrl } } }
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/repo.png' },
              topLabel: 'Repository',
              text: `${owner}/${repo}`,
              button: { text: 'Open Repository', onClick: { openLink: { url: repoUrl } } }
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/event_${eventType}.png` },
              topLabel: 'Event',
              text: eventNameFmt,
              button: { text: 'Open Event', onClick: { openLink: { url: eventUrl } } }
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/ref.png' },
              topLabel: 'Ref',
              text: ref
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/event_workflow_dispatch.png' },
              topLabel: 'Workflow',
              text: `workflow #${runNumber}`
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/actor.png' },
              topLabel: 'Actor',
              text: actor
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/download.png' },
              topLabel: 'Download',
              text: 'click to download',
              button: { text: 'Download', onClick: { openLink: { url: artifactUrl } } }
            }
          },
          ...jiraWidgets,
          ...nameWidgets
        ]
      }
    ]
  };
}

function createBody(name, card) {
  return { text: '', cardsV2: [{ cardId: name, card: { name, ...card } }] };
}

function createJiraLink(branchName, boardName, atlassianDomain) {
  core.debug(`createJiraLink input params: branchName=${branchName}, boardName=${boardName}, atlassianDomain=${atlassianDomain}`);

  const regex = new RegExp(`${boardName}-\\d+`, 'gi');
  const result = regex.exec(branchName);
  if (!result) {
    return undefined;
  }
  core.debug(`createJiraLink: result=${result}`);

  return `${atlassianDomain}/browse/${result[0]}`;
}

// exports
module.exports = { run, colors };
