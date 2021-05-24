const express = require('express');
const { Octokit } = require("@octokit/rest");
const { masterBranches, owner, repo } = require('./github_const');

const app = express();
const port = 3000;

// GitHub Octkit
const octokit = new Octokit({
  auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
});

// For example.
app.get('/', (req, res) => {
  res.end('Hello World!');
});

// My Repositories.
app.get('/my_repos', async (req, res) => {
  const {data, status} = await octokit.rest.repos.listForAuthenticatedUser();
  let text = "";
  data.forEach(data => {
    text += data.full_name + '\n';
  });
  res.end(text);
});

// Create PRs.
app.get('/create_pr_develop_into_masters', async (req, res) => {
  const head = 'develop';
  let succeededs = [];
  let faileds = [];
  for (const i in masterBranches) {
    try {
      const {data, status} = await octokit.rest.pulls.create({
        owner,
        repo,
        head,
        base: masterBranches[i]
      });
      console.log(data);
      succeededs.push(`${head} => ${masterBranches[i]}`);
    } 
    catch(e) {
      const messages = e.errors.map((error) => { return error.message });
      const message = `${head} => ${masterBranches[i]} | ` + messages;
      faileds.push(message);
    }
  }

  let message = '== Succeeded ==\n';
  message += succeededs.join('\n');
  message += '== Failed ==\n';
  message += faileds.join('\n');

  console.log(message);
  res.end();
});

// Listen starts.
app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`);
});
