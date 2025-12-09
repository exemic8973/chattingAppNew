import selfsigned from 'selfsigned';
import fs from 'fs';

const generate = async () => {
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = await selfsigned.generate(attrs, { days: 365 });

    console.log('Generated PEMs keys:', Object.keys(pems));

    fs.writeFileSync('cert.pem', pems.cert);
    fs.writeFileSync('key.pem', pems.private);

    console.log('Certificates generated: cert.pem, key.pem');
};

generate().catch(console.error);
