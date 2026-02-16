import * as fs from 'fs';
import * as path from 'path';
import { getTemplatesDir } from '../paths';

const AVAILABLE = ['basic', 'advanced-rules', 'security', 'database', 'api'];

export function runTemplate(name: string, outputPath?: string): void {
    if (!AVAILABLE.includes(name)) {
        console.error(`\x1b[31m✗\x1b[0m  Unknown template: "${name}"`);
        listTemplates();
        process.exit(1);
    }

    const templatePath = path.join(getTemplatesDir(), `${name}.md`);
    if (!fs.existsSync(templatePath)) {
        console.error(`\x1b[31m✗\x1b[0m  Template file missing: ${templatePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(templatePath, 'utf-8');

    if (outputPath) {
        const resolved = path.resolve(outputPath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');
        console.log(`\x1b[32m✔\x1b[0m  Written to ${resolved}`);
    } else {
        console.log(content);
    }
}

export function listTemplates(): void {
    console.log('\nAvailable templates:');
    for (const name of AVAILABLE) {
        console.log(`  • ${name}`);
    }
    console.log('');
}
