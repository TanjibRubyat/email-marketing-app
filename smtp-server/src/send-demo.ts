import { SMTPClient } from './smtp-client';

async function main() {
  const client = await SMTPClient.connect('127.0.0.1', 2525);

  const result = await client.sendMail({
    from: 'campaigns@example.com',
    to: ['bob@example.com', 'carol@example.com', 'nobody@invalid.test'],
    subject: 'Your weekly newsletter',
    body: [
      'Hi there,',
      '',
      'This is a test campaign sent through our own SMTP client library.',
      'It even survives a body line that starts with a literal dot:',
      '. <- this line starts with a dot and still arrives intact',
      '',
      'Thanks,',
      'The Team',
    ].join('\n'),
  });

  console.log('Accepted:', result.accepted);
  console.log('Rejected:', result.rejected);

  await client.quit();
}

main().catch((err) => {
  console.error('Send failed:', err);
  process.exit(1);
});
