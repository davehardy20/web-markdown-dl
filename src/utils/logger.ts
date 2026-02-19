import { appendFile } from 'fs/promises';

export interface LoggerOptions {
  logFile?: string;
  quiet?: boolean;
}

type LogLevel = 'DEBUG' | 'INFO' | 'ERROR';

export class Logger {
  private logFile?: string;
  private quiet: boolean;

  constructor(options: LoggerOptions = {}) {
    this.logFile = options.logFile;
    this.quiet = options.quiet ?? false;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, ...messages: unknown[]): string {
    const timestamp = this.getTimestamp();
    const content = messages
      .map((m) => (typeof m === 'object' ? JSON.stringify(m) : String(m)))
      .join(' ');
    return `[${timestamp}] [${level}] ${content}`;
  }

  private async write(level: LogLevel, ...messages: unknown[]): Promise<void> {
    const formatted = this.formatMessage(level, ...messages);

    if (!this.quiet) {
      process.stderr.write(formatted + '\n');
    }

    if (this.logFile) {
      try {
        await appendFile(this.logFile, formatted + '\n', 'utf-8');
      } catch {
        // Silently ignore file write errors to prevent infinite logging loops
      }
    }
  }

  async log(...messages: unknown[]): Promise<void> {
    await this.write('INFO', ...messages);
  }

  async debug(...messages: unknown[]): Promise<void> {
    await this.write('DEBUG', ...messages);
  }

  async info(...messages: unknown[]): Promise<void> {
    await this.write('INFO', ...messages);
  }

  async error(...messages: unknown[]): Promise<void> {
    await this.write('ERROR', ...messages);
  }
}
