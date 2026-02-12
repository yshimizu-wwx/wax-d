/**
 * GitHub Issue Auto-Uploader (Improved & Auto-detect)
 * * 使い方:
 * 1. GitHub CLI をインストールし、ターミナルで `gh auth login` を済ませておく。
 * 2. プロジェクトのルートに `issues.md` を作成し、Geminiの回答を貼り付ける。
 * 3. `node scripts/upload_issues.js` を実行。
 * 4. 実行後、重複防止のために issues.md は scripts/archives フォルダへ移動されます。
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// リポジトリ情報を自動取得する関数
function getRepoInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    // SSH形式 (git@github.com:user/repo.git) または HTTPS形式 (https://github.com/user/repo.git) に対応
    const match = remoteUrl.match(/github\.com[:/](.+)\/(.+?)(\.git)?$/);
    if (match) {
      return { owner: match[1], name: match[2] };
    }
  } catch (err) {
    return null;
  }
  return null;
}

async function uploadIssues() {
  const repoInfo = getRepoInfo();
  
  // 自動取得に失敗した場合のフォールバック
  const REPO_OWNER = repoInfo ? repoInfo.owner : "YOUR_GITHUB_USERNAME"; 
  const REPO_NAME = repoInfo ? repoInfo.name : "YOUR_REPO_NAME";
  const FILE_PATH = "issues.md";
  const ARCHIVE_DIR = path.join("scripts", "archives");

  // ログイン状態の確認（簡易的）
  try {
    execSync('gh auth status', { stdio: 'ignore' });
  } catch (err) {
    console.error("Error: GitHub CLI にログインしていないようです。先に 'gh auth login' を実行してください。");
    return;
  }

  if (REPO_OWNER === "YOUR_GITHUB_USERNAME") {
    console.error("Error: リポジトリ情報が取得できませんでした。Gitのリモート設定を確認するか、スクリプト内の変数を手動で書き換えてください。");
    return;
  }

  if (!fs.existsSync(FILE_PATH)) {
    console.log(`\n[待機中] ${FILE_PATH} が見つかりません。`);
    console.log("Geminiに文字起こしを渡し、生成された内容を 'issues.md' として保存してから再度実行してください。");
    return;
  }

  const content = fs.readFileSync(FILE_PATH, 'utf8');
  const issueBlocks = content.split('---').filter(block => block.trim().length > 10);

  if (issueBlocks.length === 0) {
    console.log("有効な Issue が見つかりませんでした。ファイル形式を確認してください。");
    return;
  }

  console.log(`\nTarget Repository: ${REPO_OWNER}/${REPO_NAME}`);
  console.log(`${issueBlocks.length} 件の Issue を検出しました。GitHubへの登録を開始します...\n`);

  for (const block of issueBlocks) {
    const titleMatch = block.match(/## \[タイトル\]: (.+)/);
    const title = titleMatch ? titleMatch[1].trim() : "New Issue from Transcript";
    const body = block.replace(/## \[タイトル\]: .+\n/, "").trim();

    try {
      // 標準入力を使って本文を渡すことで、特殊文字や改行によるエラーを回避
      const escapedTitle = title.replace(/"/g, '\\"');
      const command = `gh issue create --title "${escapedTitle}" --body-file - --repo ${REPO_OWNER}/${REPO_NAME}`;
      
      execSync(command, { input: body });
      console.log(`✅ 作成成功: ${title}`);
    } catch (error) {
      console.error(`❌ 作成失敗: ${title}`);
      console.error(error.message);
    }
  }

  // アーカイブ処理（重複登録を防止）
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePath = path.join(ARCHIVE_DIR, `issues_${timestamp}.md`);
  
  try {
    fs.renameSync(FILE_PATH, archivePath);
    console.log(`\nすべて完了しました！`);
    console.log(`送信済みの内容は ${archivePath} に保存されました。`);
  } catch (err) {
    console.error("\nファイルの移動中にエラーが発生しました:", err.message);
  }
}

uploadIssues();