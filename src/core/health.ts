/**
 * Core health checks — platform-agnostic portion.
 */
import * as fs from 'fs/promises';

/**
 * Check if a decision file or directory exists and is accessible.
 */
export async function checkDecisionFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
