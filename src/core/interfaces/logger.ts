/**
 * ILogger — Platform-agnostic logging interface.
 */
export interface ILogger {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  debug(message: string): void;
  startGroup(name: string): void;
  endGroup(): void;
}
