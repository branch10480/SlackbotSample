const { App, ExpressReceiver } = require('@slack/bolt');
const serverlessExpress = require('@vendia/serverless-express');

// カスタムのレシーバーを初期化します
const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  // `processBeforeResponse` オプションは、あらゆる FaaS 環境で必須です。
  // このオプションにより、Bolt フレームワークが `ack()` などでリクエストへの応答を返す前に
  // `app.message` などのメソッドが Slack からのリクエストを処理できるようになります。FaaS では
  // 応答を返した後にハンドラーがただちに終了してしまうため、このオプションの指定が重要になります。
  processBeforeResponse: true
});

// ボットトークンと、AWS Lambda に対応させたレシーバーを使ってアプリを初期化します。
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver
});

// Listens to incoming messages that contain "hello"
app.message('hello', async ({ message, say }) => {
  // say() sends a message to the channel where the event was triggered
  await say(`Hey there <@${message.user}>!`);
});

// Handle the Lambda function event
module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});


// (async () => {
//   // Start your app
//   await app.start(process.env.PORT || 3000);

//   console.log('⚡️ Bolt app is running!');
// })();