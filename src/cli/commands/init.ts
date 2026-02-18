import * as fs from 'fs';
import * as path from 'path';
import { getTemplatesDir } from '../paths';

export function runInit(templateName: string): void {
  const targetDir = path.resolve('.decispher');
  const targetFile = path.join(targetDir, 'decisions.md');

  if (fs.existsSync(targetFile)) {
    console.log(`\x1b[33m⚠\x1b[0m  ${targetFile} already exists. Skipping.`);
    return;
  }

  const templatePath = path.join(getTemplatesDir(), `${templateName}.md`);
  if (!fs.existsSync(templatePath)) {
    console.error(`\x1b[31m✗\x1b[0m  Template "${templateName}" not found.`);
    console.log('Available: basic, advanced-rules, security, database, api');
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(templatePath, targetFile);
  console.log(`\x1b[32m✔\x1b[0m  Created ${targetFile}`);
  console.log(`   Template: ${templateName}`);
  console.log(`\n   Edit the file to define your architectural decisions.`);
}
