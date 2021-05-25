const { App, ExpressReceiver } = require('@slack/bolt');
const serverlessExpress = require('@vendia/serverless-express');
const { Octokit } = require("@octokit/rest");
const { masterBranches, owner, repo } = require('./github_const');

const callbackIDs = {
  operatioinsSelect: 'operations_select',
};

const blockIDs = {
  operations: 'operations',
};

const actionNames = {
  selectOperations: 'select_operations',
  showRepositories: 'show_repositories',
  createPRDevelopIntoMasters: 'create_pr_develop_into_masters',
};

// カスタムのレシーバーを初期化します
const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  // `processBeforeResponse` オプションは、あらゆる FaaS 環境で必須です。
  // このオプションにより、Bolt フレームワークが `ack()` などでリクエストへの応答を返す前に
  // `app.message` などのメソッドが Slack からのリクエストを処理できるようになります。FaaS では
  // 応答を返した後にハンドラーがただちに終了してしまうため、このオプションの指定が重要になります。
  processBeforeResponse: true
});

// ボットトークンと、AWS Lambda に対応させたレシーバーを使ってアプリを初期化
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver
});

// GitHub Octkit
const octokit = new Octokit({
  auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
});

// Listens to incoming messages that contain "hello"
app.message('hello', async ({ message, say }) => {
  // say() sends a message to the channel where the event was triggered
  await say(`Hey there <@${message.user}>!`);
});

// Listens to incoming messages that contain "goodbye"
app.message('goodbye', async ({ message, say }) => {
  // say() sends a message to the channel where the event was triggered
  await say(`See ya later, <@${message.user}>! :wave:`);
});

app.command('/hello_edulis', async ({ message, ack, body, client }) => {
  await ack();
  try {
    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        "type": "modal",
        "callback_id": callbackIDs.operatioinsSelect,
        "title": {
          "type": "plain_text",
          "text": "My App",
          "emoji": true
        },
        "submit": {
          "type": "plain_text",
          "text": "決定",
          "emoji": true
        },
        "close": {
          "type": "plain_text",
          "text": "キャンセル",
          "emoji": true
        },
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "お疲れさまです！😎\n操作を選んでください。"
            }
          },
          {
            "type": "input",
            "block_id": blockIDs.operations,
            "element": {
              "type": "static_select",
              "placeholder": {
                "type": "plain_text",
                "text": "操作を選択してください",
                "emoji": true
              },
              "options": [
                {
                  "text": {
                    "type": "plain_text",
                    "text": "自分のリポジトリ一覧を表示",
                    "emoji": true
                  },
                  "value": actionNames.showRepositories
                },
                {
                  "text": {
                    "type": "plain_text",
                    "text": "develop -> master/* へのPRを作成",
                    "emoji": true
                  },
                  "value": actionNames.createPRDevelopIntoMasters
                },
              ],
              action_id: actionNames.selectOperations
            },
            "label": {
              "type": "plain_text",
              "text": "操作",
              "emoji": true
            }
          }
        ]
      }
    });
    console.log(result);
  } catch(e) {
    console.log(e);
  }
});

// View submissions. ================================

app.view(callbackIDs.operatioinsSelect, async ({ ack, body, view, client }) => {
  await ack();
  const selectedOptionName = view['state']['values'][blockIDs.operations][actionNames.selectOperations]['selected_option']['value'];
  const user = body['user']['id'];

  switch (selectedOptionName) {
    case actionNames.showRepositories:
      try {
        const text = await getMyRepos();
        await client.chat.postMessage({
          channel: user,
          text: text,
        });
      } catch(e) {
        console.log(e);
      }
      break;
    case actionNames.createPRDevelopIntoMasters:
      const text = await createPRDevelopIntoMasters();
      try {
        await client.chat.postMessage({
          channel: user,
          text: text,
        });
      } catch(e) {
        console.log(e);
      }
      break;
  }
});

// Functions. ========================================

async function getMyRepos() {
  const { data, status } = await octokit.rest.repos.listForAuthenticatedUser();
  let text = "";
  data.forEach(data => {
    text += data.full_name + '\n';
  });
  return text;
}

// develop -> [targets] のPRを作成する
async function createPRDevelopIntoMasters() {
  const head = 'develop';
  let succeededs = [];
  let faileds = [];
  let createdPRs = [];
  for (const i in masterBranches) {
    const title = `【Auto】${head} => ${masterBranches[i]}`;
    try {
      const {data, status} = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        head,
        base: masterBranches[i]
      });
      createdPRs.push(data);
      succeededs.push(title);
    } 
    catch(e) {
      console.log(e);
      faileds.push(String(e));
    }
  }

  let message = '== Create PRs ==\n';
  message += '-- Succeeded --\n';
  message += succeededs.join('\n');
  message += '-- Failed --\n';
  message += faileds.join('\n');
  message += '\n\n';

  message += await mergePRs(createdPRs);
  
  console.log(message);
  return message;
}

// 対象のPRをマージする
async function mergePRs(prDataList) {
  let message = '== Merge PRs ==\n';
  let succeededs = [];
  let faileds = [];
  for (const i in prDataList) {
    const data = prDataList[i];
    try {
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: data.number
      });
      succeededs.push(data.title);
    } catch(e) {
      const messages = e.errors.map((error) => { return error.message });
      const message = data.title + messages;
      faileds.push(message);
    }
  }
  message += '-- Succeeded --\n';
  message += succeededs.join('\n');
  message += '\n';
  message += '-- Failed --\n';
  message += faileds.join('\n');
  return message;
}

// Messages. =========================================

app.message('myRepos', async ({ message, say }) => {
  await say('OK, just a minute!');
  const text = await getMyRepos();
  await say(text);
  await say('Completed!');
});

// Main. =============================================

// Handle the Lambda function event
module.exports.handler = serverlessExpress({
  app: expressReceiver.app,
  setTimeout: 7000,
});