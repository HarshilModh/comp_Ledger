import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function curlGet(url, timeoutMs = 15000, extraArgs = []) {
  try {
    const timeoutSec = Math.ceil(timeoutMs / 1000);
    const args = ['-s', '--max-time', String(timeoutSec), ...extraArgs, url];
    const { stdout } = await execFileAsync('curl', args, {
      encoding: 'utf-8',
      timeout: timeoutMs + 2000,
    });
    return stdout;
  } catch {
    return null;
  }
}

export async function curlGetJson(url, timeoutMs = 15000) {
  const text = await curlGet(url, timeoutMs);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
