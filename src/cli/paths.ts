import * as path from 'path';

export function getTemplatesDir(): string {
  return path.join(__dirname, '..', '..', 'templates');
}
