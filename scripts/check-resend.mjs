import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { connect } from 'node:tls';

async function check() {
  const env = parseEnv(await readFile(new URL('../.dev.vars',import.meta.url),'utf8'));
  const key = env.RESEND_API_KEY?.trim();
  if (!key?.startsWith('re_') || /\s/.test(key)) throw new Error('Add the same Resend key used as the Supabase SMTP password to RESEND_API_KEY in .dev.vars.');
  const encoded = Buffer.from(`\0resend\0${key}`).toString('base64');
  const redact = text => text.split(key).join('[redacted]').split(encoded).join('[redacted]');
  const socket = connect({host:'smtp.resend.com',port:465,servername:'smtp.resend.com',rejectUnauthorized:true});
  let buffer='', lines=[], pending=null, failure=null;
  const replies=[];
  const fail = error => { failure=error; if(pending){const wait=pending;pending=null;wait.reject(error);} };
  socket.setTimeout(15000,()=>{fail(new Error('The SMTP connection timed out.'));socket.destroy();});
  socket.on('error',()=>fail(new Error('The encrypted SMTP connection failed.')));
  socket.on('end',()=>fail(new Error('The SMTP server closed the connection.')));
  socket.on('data',chunk=>{
    buffer+=chunk.toString('utf8');
    let end;
    while((end=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);lines.push(line);
      if(/^\d{3} /.test(line)){
        const reply={code:Number(line.slice(0,3)),text:lines.join(' | ')};lines=[];
        if(pending){const wait=pending;pending=null;wait.resolve(reply);}else replies.push(reply);
      }
    }
  });
  const read=()=>replies.length?Promise.resolve(replies.shift()):failure?Promise.reject(failure):new Promise((resolve,reject)=>{pending={resolve,reject};});
  const command=async value=>{socket.write(`${value}\r\n`);return read();};
  const expect=(reply,code,label)=>{
    if(reply.code!==code) throw new Error(`${label}: ${redact(reply.text)}`);
    console.log(`${label}: OK (${reply.code})`);
  };
  try {
    expect(await read(),220,'TLS connection');
    expect(await command('EHLO tomodo.app'),250,'SMTP handshake');
    let auth=await command(`AUTH PLAIN ${encoded}`);
    if(auth.code===334) auth=await command(encoded);
    expect(auth,235,'Resend API-key authentication');
    expect(await command('MAIL FROM:<hello@tomodo.app>'),250,'Sender envelope acceptance');
    expect(await command('RSET'),250,'Abort test transaction');
    await command('QUIT');
    console.log('No email was sent. This verifies SMTP connection/authentication and preliminary sender acceptance, not message delivery.');
  } finally { socket.destroy(); }
}
check().catch(error=>{console.error(error.message);process.exitCode=1;});
