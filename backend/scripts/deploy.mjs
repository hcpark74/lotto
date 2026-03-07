import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

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

execSync('wrangler deploy', { stdio: 'inherit', env: mergedEnv });
