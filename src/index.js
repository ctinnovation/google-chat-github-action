/**
 * The entrypoint for the action.
 */
// const { run } = require('./main');
// run();

const core = require('@actions/core');
const https = require('https');
const { URL } = require('url');

async function run() {
    try {
        const name = core.getInput('name', { required: true });
        const webhookUrl = core.getInput('url', { required: true });
        const status = core.getInput('status', { required: true });
        const artifactUrl = core.getInput('artifactUrl') || '—';




        const emoji = status === 'success' ? '✅' : '❌';

        const payload = JSON.stringify({
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    content: {
                        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                        type: "AdaptiveCard",
                        version: "1.5",
                        body: [
                            {
                                type: "ColumnSet",
                                columns: [
                                    {
                                        type: "Column",
                                        width: "auto",
                                        items: [
                                            {
                                                type: "Image",
                                                url: "https://avatars.githubusercontent.com/u/9919?v=4",
                                                style: "person",
                                                size: "Small"
                                            }
                                        ]
                                    },
                                    {
                                        type: "Column",
                                        width: "stretch",
                                        items: [
                                            {
                                                type: "TextBlock",
                                                text: `${emoji} ${name}`,
                                                weight: "Bolder",
                                                wrap: true
                                            },
                                            {
                                                type: "TextBlock",
                                                text: "Nuova build",
                                                wrap: true,
                                                spacing: "None"
                                            }
                                        ]
                                    }

                                ]
                            }
                        ],
                        actions: [
                            {
                                type: "Action.OpenUrl",
                                title: "🔗 Download",
                                url: artifactUrl
                            }
                        ]
                    }
                }
            ]
        });
        // const payload = JSON.stringify({
        //   type: "message",
        //   attachments: [
        //     {
        //       contentType: "application/vnd.microsoft.card.adaptive",
        //       content: {
        //         $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        //         type: "AdaptiveCard",
        //         version: "1.4",
        //         body: [
        //           {
        //             type: "TextBlock",
        //             text: `${emoji} Build Notification`,
        //             weight: "Bolder",
        //             size: "Medium"
        //           },
        //           {
        //             type: "FactSet",
        //             facts: [
        //               { title: "Progetto:", value: project },
        //               { title: "Branch:", value: branch },
        //               { title: "Stato:", value: `${emoji} ${status}` }
        //             ]
        //           },
        //           {
        //             type: "TextBlock",
        //             text: "📎 Artifact URL:",
        //             weight: "Bolder",
        //             spacing: "Medium"
        //           },
        //           {
        //             type: "TextBlock",
        //             text: artifactUrl,
        //             wrap: true,
        //             selectable: true
        //           }
        //         ],
        //         actions: [
        //           {
        //             type: "Action.OpenUrl",
        //             title: "🔗 Apri Artifact",
        //             url: artifactUrl
        //           }
        //         ]
        //       }
        //     }
        //   ]
        // });

        const url = new URL(webhookUrl);
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

        req.on('error', error => core.setFailed(error.message));
        req.write(payload);
        req.end();

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();

