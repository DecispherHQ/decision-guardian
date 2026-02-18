/**
 * ActionsLogger — ILogger implementation wrapping @actions/core.
 *
 * Used when running inside the GitHub Actions runtime.
 */
import * as core from '@actions/core';
import type { ILogger } from '../../core/interfaces/logger';

export class ActionsLogger implements ILogger {
  info(message: string): void {
    core.info(message);
  }

  warning(message: string): void {
    core.warning(message);
  }

  error(message: string): void {
    core.error(message);
  }

  debug(message: string): void {
    core.debug(message);
  }

  startGroup(name: string): void {
    core.startGroup(name);
  }

  endGroup(): void {
    core.endGroup();
  }

  // ── Actions-Specific Methods ──────────────────────────────────

  /**
   * Set an output variable for subsequent steps.
   */
  setOutput(name: string, value: string): void {
    core.setOutput(name, value);
  }

  /**
   * Mark the action as failed with an error message.
   */
  setFailed(message: string): void {
    core.setFailed(message);
  }

  /**
   * Get an input variable from the action configuration.
   */
  getInput(name: string, required?: boolean): string {
    return core.getInput(name, { required });
  }

  /**
   * Get a boolean input variable from the action configuration.
   */
  getBooleanInput(name: string): boolean {
    return core.getBooleanInput(name);
  }
}
