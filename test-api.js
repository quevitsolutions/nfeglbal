fetch('https://promo.nfeglobal.online/api/ai/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Write a promotional tweet for NFEGlobal Core.' })
}).then(r => r.text()).then(console.log).catch(console.error);
