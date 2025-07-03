const core = require('@actions/core');
const https = require('https');
const { URL } = require('url');

async function run() {
  try {
    const webhookUrl = core.getInput('webhook-url');
    const status = core.getInput('status');
    const project = core.getInput('project');
    const branch = core.getInput('branch');
    const artifactUrl = core.getInput('artifact-url') || '—';

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
              type: "TextBlock",
              text: "Nuova build",
              weight: "Bolder",
              size: "Medium"
            },
            {
                 type: "TextBlock",
                 text: `${emoji} Build Notification`,
                 weight: "Bolder",
                 size: "Medium"
               },
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