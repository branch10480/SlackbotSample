const { App, ExpressReceiver } = require('@slack/bolt');
const serverlessExpress = require('@vendia/serverless-express');
const { Octokit } = require("@octokit/rest");

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

// Listens to incoming messages that contain "myRepos"
app.message('myRepos', async ({ message, say }) => {
  // GitHub REST API にアクセスする
  await say('OK, just a minute!');
  await octokit.rest.repos.listForAuthenticatedUser().then(async response => {
    const status = response.status;
    const dataArray = response.data;
    let text = "";
    dataArray.forEach(data => {
      text += data.full_name + '\n';
    });
    await say(text);
    await say('Completed!');
  });
});

// Handle the Lambda function event
module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});