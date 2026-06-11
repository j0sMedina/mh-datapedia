import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
  execSync('pnpm prisma migrate reset --force --skip-seed', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env },
    stdio: 'inherit',
  });
}
