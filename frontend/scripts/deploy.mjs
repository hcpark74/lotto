import { readFileSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { resolve } from 'path';

const DEPLOY_RETRY_COUNT = 3;
const DEPLOY_RETRY_DELAY_MS = 5000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 재시도 판정에는 끝부분 출력만 있으면 된다
const CAPTURED_OUTPUT_LIMIT = 64 * 1024;

// stdio: 'inherit' 로는 wrangler 출력이 error.message 에 남지 않아 재시도 판정을 할 수 없다.
// 출력을 화면에 그대로 흘려보내면서 끝부분만 모아 두었다가 실패 시 에러에 담는다.
function runCaptured(command, env) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, { shell: true, env, stdio: ['inherit', 'pipe', 'pipe'] });
        let output = '';
        const capture = (stream, target) => {
            // 조각 경계에 걸린 멀티바이트 문자(한글 등)가 깨지지 않도록 스트림 단위로 디코딩한다
            stream.setEncoding('utf8');
            stream.on('data', text => {
                target.write(text);
                output = (output + text).slice(-CAPTURED_OUTPUT_LIMIT);
            });
        };
        capture(child.stdout, process.stdout);
        capture(child.stderr, process.stderr);
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) resolvePromise();
            else reject(new Error(`Command failed (exit ${code}): ${command}\n${output}`));
        });
    });
}

function shouldRetryDeploy(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('504 Gateway Timeout')
        || message.includes('upstream request timeout')
        || message.includes('Received a malformed response from the API');
}

// .env.production 파일을 읽어 환경변수로 주입 (없으면 환경변수에서 직접 읽음)
const envPath = resolve(process.cwd(), '.env.production');
const env = {};
try {
    readFileSync(envPath, 'utf8').trim().split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx > 0) {
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 1).trim();
            if (key) env[key] = val;
        }
    });
} catch {
    // CI 환경 등 .env.production이 없는 경우 process.env 사용
}

const mergedEnv = { ...process.env, ...env };

// package.json 의 build 와 같게 타입 체크를 먼저 통과시킨다
execSync('npm exec -- tsc', { stdio: 'inherit', env: mergedEnv });
execSync('npm exec -- vite build', { stdio: 'inherit', env: mergedEnv });

let lastError;

for (let attempt = 1; attempt <= DEPLOY_RETRY_COUNT; attempt += 1) {
    try {
        await runCaptured('npm exec -- wrangler pages deploy dist --project-name=lotto-frontend --commit-dirty=true', mergedEnv);
        lastError = undefined;
        break;
    } catch (error) {
        lastError = error;

        if (!shouldRetryDeploy(error) || attempt === DEPLOY_RETRY_COUNT) {
            throw error;
        }

        console.warn(`\n[deploy] Cloudflare API timeout detected. Retrying ${attempt}/${DEPLOY_RETRY_COUNT - 1} in ${DEPLOY_RETRY_DELAY_MS / 1000}s...\n`);
        await sleep(DEPLOY_RETRY_DELAY_MS);
    }
}

if (lastError) {
    throw lastError;
}
