import net from 'net';

/**
 * SMTP is a line-based, text protocol over TCP. A client connects, and the
 * two sides exchange commands/responses, each terminated by CRLF ("\r\n").
 *
 * The conversation for sending ONE email looks like this:
 *
 *   Server: 220 localhost SMTP Test Server Ready
 *   Client: EHLO client.example.com
 *   Server: 250 Hello client.example.com
 *   Client: MAIL FROM:<alice@example.com>
 *   Server: 250 OK
 *   Client: RCPT TO:<bob@example.com>
 *   Server: 250 OK
 *   Client: DATA
 *   Server: 354 End data with <CR><LF>.<CR><LF>
 *   Client: Subject: Hello
 *   Client:
 *   Client: This is the message body.
 *   Client: .                              <-- single dot on its own line = end of message
 *   Server: 250 OK: message accepted
 *   Client: QUIT
 *   Server: 221 Bye
 *
 * Every command must arrive in the right order. That's why we track a
 * "state" per connection (a session) and reject commands that arrive out
 * of sequence with a 503 "Bad sequence of commands" error.
 */

type SMTPState = 'CONNECTED' | 'GREETED' | 'MAIL' | 'RCPT' | 'DATA';

interface SMTPSession {
  state: SMTPState;
  clientHost?: string;
  mailFrom?: string;
  rcptTo: string[];
  dataBuffer: string[];
}

const PORT = 2525; // Real SMTP uses port 25, but that needs root + is often
                    // blocked by ISPs. 2525 is a common alternative for dev/testing.

const server = net.createServer((socket) => {
  const session: SMTPSession = {
    state: 'CONNECTED',
    rcptTo: [],
    dataBuffer: [],
  };

  console.log(`[+] Connection from ${socket.remoteAddress}:${socket.remotePort}`);

  // The FIRST thing an SMTP server does, before the client sends anything,
  // is announce itself. Code 220 = "Service ready".
  socket.write('220 localhost SMTP Test Server Ready\r\n');

  // TCP doesn't guarantee we receive whole lines at once - a command could
  // arrive split across two `data` events, or two commands could arrive
  // in a single event. So we buffer everything and only process complete
  // lines (split on CRLF), keeping any trailing partial line for next time.
  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');

    const lines = buffer.split('\r\n');
    buffer = lines.pop() ?? ''; // last element is "" or an incomplete line

    for (const line of lines) {
      handleLine(socket, session, line);
    }
  });

  socket.on('end', () => {
    console.log('[-] Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('[!] Socket error:', err.message);
  });
});

function handleLine(socket: net.Socket, session: SMTPSession, line: string): void {
  // --- Special case: we're inside the DATA block ---
  // Once the client sends "DATA" and we reply 354, everything that follows
  // is raw message content (headers + body), NOT commands, until we see a
  // line containing only a single ".".
  if (session.state === 'DATA') {
    if (line === '.') {
      const message = session.dataBuffer.join('\r\n');

      console.log('--- Message received ---');
      console.log(`From: ${session.mailFrom}`);
      console.log(`To:   ${session.rcptTo.join(', ')}`);
      console.log(message);
      console.log('-------------------------');

      // Reset session state so this connection can send another message
      // (real SMTP servers support multiple MAIL FROM/DATA cycles per connection).
      session.dataBuffer = [];
      session.mailFrom = undefined;
      session.rcptTo = [];
      session.state = 'GREETED';

      socket.write('250 OK: message accepted for delivery\r\n');
      return;
    }

    // "Dot-stuffing": if a content line genuinely starts with a dot,
    // the client doubles it (".." ) so it isn't mistaken for the
    // end-of-message marker. We undo that here.
    session.dataBuffer.push(line.startsWith('..') ? line.slice(1) : line);
    return;
  }

  if (line.trim() === '') return; // ignore stray blank lines between commands

  console.log(`> ${line}`);

  const spaceIndex = line.indexOf(' ');
  const command = (spaceIndex === -1 ? line : line.slice(0, spaceIndex)).toUpperCase();
  const arg = spaceIndex === -1 ? '' : line.slice(spaceIndex + 1).trim();

  switch (command) {
    case 'EHLO':
    case 'HELO':
      session.clientHost = arg;
      session.state = 'GREETED';
      socket.write(`250 Hello ${arg}, pleased to meet you\r\n`);
      break;

    case 'MAIL':
      if (session.state === 'CONNECTED') {
        socket.write('503 Bad sequence: send EHLO/HELO first\r\n');
        return;
      }
      // arg looks like: "FROM:<alice@example.com>"
      session.mailFrom = extractEmail(arg);
      session.rcptTo = [];
      session.state = 'MAIL';
      socket.write('250 OK\r\n');
      break;

    case 'RCPT': {
      if (session.state !== 'MAIL' && session.state !== 'RCPT') {
        socket.write('503 Bad sequence: send MAIL FROM first\r\n');
        return;
      }
      // arg looks like: "TO:<bob@example.com>"
      const recipient = extractEmail(arg);

      // Simulate a real-world bounce: this domain always gets rejected.
      // A 550 here is a *permanent* failure for this one recipient only -
      // it does NOT abort the whole transaction. A client should be able
      // to keep sending RCPT TO for the other recipients afterwards.
      if (recipient.endsWith('@invalid.test')) {
        socket.write('550 No such mailbox\r\n');
        return; // state unchanged - client may try another RCPT TO
      }

      session.rcptTo.push(recipient);
      session.state = 'RCPT';
      socket.write('250 OK\r\n');
      break;
    }

    case 'DATA':
      if (session.state !== 'RCPT') {
        socket.write('503 Bad sequence: need at least one RCPT TO first\r\n');
        return;
      }
      session.state = 'DATA';
      session.dataBuffer = [];
      socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      break;

    case 'RSET':
      session.state = 'GREETED';
      session.mailFrom = undefined;
      session.rcptTo = [];
      session.dataBuffer = [];
      socket.write('250 OK\r\n');
      break;

    case 'NOOP':
      socket.write('250 OK\r\n');
      break;

    case 'QUIT':
      socket.write('221 Bye\r\n');
      socket.end();
      break;

    default:
      socket.write('500 Command not recognized\r\n');
  }
}

/** Pulls "alice@example.com" out of "FROM:<alice@example.com>" or similar. */
function extractEmail(arg: string): string {
  const match = arg.match(/<([^>]*)>/);
  if (match) return match[1];
  return arg.replace(/^(FROM|TO)\s*:\s*/i, '').trim();
}

server.listen(PORT, () => {
  console.log(`SMTP test server listening on 127.0.0.1:${PORT}`);
});
