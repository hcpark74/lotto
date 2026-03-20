import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const DEPLOY_RETRY_COUNT = 3;
const DEPLOY_RETRY_DELAY_MS = 5000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

execSync('npm exec -- vite build', { stdio: 'inherit', env: mergedEnv });

let lastError;

for (let attempt = 1; attempt <= DEPLOY_RETRY_COUNT; attempt += 1) {
    try {
        execSync('npm exec -- wrangler pages deploy dist --project-name=lotto-frontend --commit-dirty=true', {
            stdio: 'inherit',
            env: mergedEnv,
        });
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
