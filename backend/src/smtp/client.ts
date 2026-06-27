import net from 'net';

/**
 * A reusable SMTP client - the piece the rest of the app will eventually
 * call to actually send campaign emails. Unlike test-client.ts (which just
 * fires commands in a hardcoded sequence), this one:
 *
 *  1. Correctly parses MULTI-LINE server responses. A real server's EHLO
 *     reply often looks like:
 *         250-mail.example.com greets you
 *         250-PIPELINING
 *         250 SIZE 10485760
 *     Lines are "more coming" if the 4th character is '-', and "final"
 *     if it's a space. We must wait for the final line before treating
 *     the command as answered.
 *
 *  2. Handles PER-RECIPIENT failure. In a real send to 500 contacts, a
 *     handful of addresses will always bounce (550 No such mailbox).
 *     That shouldn't abort the other 495 - so RCPT TO failures are
 *     collected, not thrown.
 *
 *  3. Exposes a small Promise-based API (`connect`, `sendMail`, `quit`)
 *     instead of manual socket plumbing, so the rest of the app doesn't
 *     need to know SMTP exists.
 */

export interface SendMailOptions {
  from: string;
  to: string[];
  subject: string;
  body: string;
  clientHost?: string;
  headers?: Record<string, string>;
}

export interface SendMailResult {
  accepted: string[];
  rejected: { recipient: string; reason: string }[];
}

interface ParsedResponse {
  code: number;
  lines: string[];
}

/** Thrown when the server gives back a 4xx (temporary) or 5xx (permanent) error. */
export class SMTPError extends Error {
  constructor(public code: number, serverMessage: string) {
    super(`SMTP ${code}: ${serverMessage}`);
    this.name = 'SMTPError';
  }
}

export class SMTPClient {
  private lineBuffer = '';
  private blockLines: string[] = [];
  private waiter: { resolve: (r: ParsedResponse) => void; reject: (e: Error) => void } | null = null;

  private constructor(private socket: net.Socket) {
    socket.on('data', (chunk) => this.handleData(chunk));
    socket.on('error', (err) => this.waiter?.reject(err));
    socket.on('close', () => {
      this.waiter?.reject(new Error('Connection closed unexpectedly'));
    });
  }

  /** Opens the TCP connection and waits for the server's 220 greeting. */
  static async connect(host: string, port: number, timeoutMs = 10_000): Promise<SMTPClient> {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('error', reject);
      socket.once('timeout', () => reject(new Error('Connection timed out')));
    });

    const client = new SMTPClient(socket);
    const greeting = await client.awaitResponse();
    if (greeting.code !== 220) {
      throw new SMTPError(greeting.code, greeting.lines.join(' '));
    }
    return client;
  }

  /** Sends one full email: EHLO, MAIL FROM, RCPT TO (per recipient), DATA. */
  async sendMail(opts: SendMailOptions): Promise<SendMailResult> {
    await this.command(`EHLO ${opts.clientHost ?? 'localhost'}`, [250]);
    await this.command(`MAIL FROM:<${opts.from}>`, [250]);

    const accepted: string[] = [];
    const rejected: { recipient: string; reason: string }[] = [];

    for (const recipient of opts.to) {
      try {
        await this.command(`RCPT TO:<${recipient}>`, [250, 251]);
        accepted.push(recipient);
      } catch (err) {
        rejected.push({
          recipient,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (accepted.length === 0) {
      // Every recipient bounced. This is NOT an exceptional/unexpected
      // condition - it's a normal outcome the caller needs in the return
      // value, not an exception. Don't attempt DATA (the server would
      // reject it with 503 anyway, since RCPT never succeeded).
      return { accepted, rejected };
    }

    await this.command('DATA', [354]);

    this.socket.write(buildMessage(opts));
    const finalResponse = await this.awaitResponse(); // reply to the terminating "."
    if (finalResponse.code !== 250) {
      throw new SMTPError(finalResponse.code, finalResponse.lines.join(' '));
    }

    return { accepted, rejected };
  }

  async quit(): Promise<void> {
    try {
      await this.command('QUIT', [221]);
    } finally {
      this.socket.end();
    }
  }

  // --- internals ---

  private handleData(chunk: Buffer): void {
    this.lineBuffer += chunk.toString('utf8');
    let idx: number;
    while ((idx = this.lineBuffer.indexOf('\r\n')) !== -1) {
      const line = this.lineBuffer.slice(0, idx);
      this.lineBuffer = this.lineBuffer.slice(idx + 2);
      this.consumeLine(line);
    }
  }

  private consumeLine(line: string): void {
    const code = parseInt(line.slice(0, 3), 10);
    const isFinalLine = line.charAt(3) !== '-'; // '-' = more lines coming, ' ' = last line
    this.blockLines.push(line.slice(4));

    if (isFinalLine && this.waiter) {
      const result: ParsedResponse = { code, lines: this.blockLines };
      this.blockLines = [];
      const { resolve } = this.waiter;
      this.waiter = null;
      resolve(result);
    }
  }

  private awaitResponse(): Promise<ParsedResponse> {
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject };
    });
  }

  /** Sends a command and rejects with SMTPError if the response code isn't expected. */
  private async command(cmd: string, expectedCodes: number[]): Promise<ParsedResponse> {
    this.socket.write(cmd + '\r\n');
    const res = await this.awaitResponse();
    if (!expectedCodes.includes(res.code)) {
      throw new SMTPError(res.code, res.lines.join(' '));
    }
    return res;
  }
}

/** Builds the RFC 5322 message (headers + body) with dot-stuffing and the end-of-data marker. */
function buildMessage(opts: SendMailOptions): string {
  const headerLines = [
    `Subject: ${opts.subject}`,
    `From: ${opts.from}`,
    `To: ${opts.to.join(', ')}`,
    ...Object.entries(opts.headers ?? {}).map(([key, value]) => `${key}: ${value}`),
  ];

  const bodyLines = opts.body
    .split(/\r\n|\n/)
    .map((line) => (line.startsWith('.') ? '.' + line : line)); // dot-stuffing

  return [...headerLines, '', ...bodyLines].join('\r\n') + '\r\n.\r\n';
}
