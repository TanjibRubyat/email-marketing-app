import net from 'net';

/**
 * A minimal SMTP client built on raw sockets, with no SMTP library.
 *
 * The trick to talking SMTP as a client is: send a command, then WAIT for
 * the server's response line before sending the next command. SMTP is
 * strictly request -> response -> request -> response (synchronous),
 * never send commands back-to-back without reading the reply first.
 */

const HOST = '127.0.0.1';
const PORT = 2525;

const FROM = 'alice@example.com';
const TO = 'bob@example.com';
const SUBJECT = 'Hello from the hand-rolled SMTP client';
const BODY = 'This message was sent using nothing but a raw TCP socket.';

const socket = net.createConnection(PORT, HOST);

// Each entry: the command to send once it's our turn to talk.
// We step through this list one at a time, waiting for a server reply
// between each step.
const commands = [
  `EHLO test-client.local`,
  `MAIL FROM:<${FROM}>`,
  `RCPT TO:<${TO}>`,
  `DATA`,
  // Once DATA is acknowledged (354), everything below is message content,
  // ending with a lone "." on its own line.
  [
    `Subject: ${SUBJECT}`,
    `From: ${FROM}`,
    `To: ${TO}`,
    '', // blank line separates headers from body, per RFC 5322
    BODY,
    '.',
  ].join('\r\n'),
  `QUIT`,
];

let step = 0;

socket.on('connect', () => {
  console.log('[+] Connected to SMTP server');
});

socket.on('data', (chunk) => {
  const response = chunk.toString('utf8').trim();
  console.log(`< ${response}`);

  // The server's very first message (the 220 greeting) arrives before we've
  // sent anything. After that, every response we receive means "your last
  // command was processed, send the next one."
  if (step < commands.length) {
    const next = commands[step++];
    console.log(`> ${next.split('\r\n')[0]}${next.includes('\r\n') ? ' ...(message body)' : ''}`);
    socket.write(next + '\r\n');
  }
});

socket.on('end', () => {
  console.log('[-] Connection closed by server');
});

socket.on('error', (err) => {
  console.error('[!] Connection error:', err.message);
});
