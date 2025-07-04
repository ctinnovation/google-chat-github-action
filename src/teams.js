

const github = require('@actions/github');
const core = require('@actions/core');
const https = require('https');
const { URL } = require('url');

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

async function run() {
    try {
        const name = core.getInput('name', { required: true });
        const webhookUrl = core.getInput('url', { required: true });
        const status = core.getInput('status', { required: true });
        const artifactUrl = core.getInput('artifactUrl') || '—';
        const boardName = core.getInput('jiraBoardName');
        const atlassianDomain = core.getInput('atlassianDomain');






        core.debug(`input params: name=${name}, status=${status}, webhookUrl=${webhookUrl}, artifactUrl=${artifactUrl}`);

        const ok = await sendNotification(name, webhookUrl, status, artifactUrl, boardName, atlassianDomain);
        if (!ok) {
            core.setFailed('error sending notification to google chat');
        } else {
            core.debug(`Sent notification: ${name}, ${status}`);
        }

    } catch (error) {
        core.setFailed(error.message);
    }
}

async function sendNotification(name, webhookUrl, status, artifactUrl, boardName, atlassianDomain) {
    const { owner, repo } = github.context.repo;
    const { eventName, sha, ref, actor, workflow, runNumber } = github.context;
    const { number } = github.context.issue;

    const jiraIssueLink = createJiraLink(name, boardName, atlassianDomain);


    const payload = JSON.stringify(createCard({ name, status, owner, repo, eventName, ref, actor, workflow, sha, number, artifactUrl, runNumber, jiraIssueLink }));


    const url = new URL(webhookUrl);
    try {
        const req = https.request(
            {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length
                }
            },
            res => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    core.setFailed(`HTTP ${res.statusCode}`);
                }
            }
        );

        req.on('error', error => {
            core.setFailed(error.message);
        });

        req.write(payload);
        req.end();
        return true;
    } catch (err) {
        core.setFailed(`Unexpected error: ${err.message}`);
        return false;
    }
}

function createJiraLink(branchName, boardName, atlassianDomain) {
    core.debug(`createJiraLink input params: branchName=${branchName}, boardName=${boardName}, atlassianDomain=${atlassianDomain}`);

    const regex = new RegExp(`${boardName}-\\d+`, 'gi');
    const result = regex.exec(branchName);
    if (!result) {
        return "not found";
    }
    core.debug(`createJiraLink: result=${result}`);

    return `${atlassianDomain}/browse/${result[0]}`;
}

function createCard({ name, status, owner, repo, eventName, ref, actor, workflow, sha, number, artifactUrl, runNumber, jiraIssueLink }) {
    let statusColor;
    let statusEmoji;
    let statusType = status.toLowerCase();
    if (status.toLowerCase() === 'success') {
        statusColor = colors.success;
        statusEmoji = '✅'
    } else if (status.toLowerCase() === 'failure') {
        statusColor = colors.failure;
        statusEmoji = '❌'
    } else {
        statusColor = colors.other;
        statusType = 'cancelled';
        statusEmoji = '🚫'

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

    const content = {
        "type": "AdaptiveCard",
        "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.5",
        "body": [
            {
                "type": "ColumnSet",
                "columns": [
                    {
                        "type": "Column",
                        "width": "auto",
                        "items": [
                            {
                                "type": "Image",
                                "url": "https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/GitHub-Logo.png",
                                "width": "50px"
                            }
                        ],
                        "verticalContentAlignment": "Center"
                    },
                    {
                        "type": "Column",
                        "width": "stretch",
                        "items": [
                            {
                                "type": "TextBlock",
                                "id": "title",
                                "text": `${name}`,
                                "weight": "Bolder"
                            },
                            {
                                "type": "TextBlock",
                                "wrap": true,
                                "id": "subtitle",
                                "text": `${owner}/${repo} #${runNumber}`,
                                "spacing": "None",
                                "isSubtle": true
                            }
                        ]
                    }
                ]
            },
            {
                "type": "ColumnSet",
                "separator": true,
                "columns": [
                    {
                        "type": "Column",
                        "width": "auto",
                        "verticalContentAlignment": "Center",
                        "items": [
                            {
                                "type": "Image",
                                "url": `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/status_${statusType}.png`,
                                "width": "20px"
                            }
                        ],
                    },
                    {
                        "type": "Column",
                        "width": "stretch",
                        "verticalContentAlignment": "Center",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": "Status",
                                "size": "Small",
                                "isSubtle": true
                            },
                            {
                                "type": "TextBlock",
                                "text": `${statusType}`,
                                "spacing": "None"
                            }
                        ]
                    },
                    {
                        "type": "Column",
                        "width": "auto",
                        "verticalContentAlignment": "Center",
                        "items": [
                            {
                                "type": "ActionSet",
                                "actions": [
                                    {
                                        "type": "Action.OpenUrl",
                                        "title": "Download",
                                        "url": `${artifactUrl}`,
                                        "iconUrl": "icon:ArrowDownload"
                                    }
                                ]
                            }
                        ]
                    }

                ]
            },
            {
                "type": "Container",
                "id": "extrainfo",
                "isVisible": false,
                "items": [
                    {
                        "type": "ColumnSet",
                        "selectAction": {
                            "type": "Action.OpenUrl",
                            "url": `${repoUrl}`
                        },
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/repo.png`,
                                        "width": "20px"
                                    }
                                ],
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "Repository",
                                        "size": "Small",
                                        "isSubtle": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `${owner}/${repo}`,
                                        "spacing": "None"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "ColumnSet",
                        "selectAction": {
                            "type": "Action.OpenUrl",
                            "url": `${checksUrl}`
                        },
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/event_workflow_dispatch.png`,
                                        "width": "20px"
                                    }
                                ],
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "Workflow",
                                        "size": "Small",
                                        "isSubtle": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `workflow #${runNumber}`,
                                        "spacing": "None"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/event_${eventType}.png`,
                                        "width": "20px"
                                    }
                                ],
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "Event",
                                        "size": "Small",
                                        "isSubtle": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `${eventNameFmt}`,
                                        "spacing": "None"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/actor.png`,
                                        "width": "20px"
                                    }
                                ],
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "Actor",
                                        "size": "Small",
                                        "isSubtle": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `${actor}`,
                                        "spacing": "None"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "ColumnSet",
                        "selectAction": {
                            "type": "Action.OpenUrl",
                            "url": `${jiraIssueLink}`
                        },
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": `https://raw.githubusercontent.com/ctinnovation/google-chat-github-action/main/assets/jira.png`,
                                        "width": "20px"
                                    }
                                ],
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "Jira issue",
                                        "size": "Small",
                                        "isSubtle": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `${jiraIssueLink}`,
                                        "spacing": "None"
                                    }
                                ]
                            }
                        ]
                    }]
            },
            {
                "type": "Container",
                "separator": true,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "Collapse/Uncollapse",
                        "size": "Small",
                        "horizontalAlignment": "Center"
                    }
                ],
                "selectAction": {
                    "type": "Action.ToggleVisibility",
                    "targetElements": ["extrainfo"]
                }
            },

        ]
    }


    return {
        type: "message",
        attachments: [
            {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: content
            }
        ]
    };
}

module.exports = { run, colors };