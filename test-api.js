fetch('https://promo.aipcore.online/api/ai/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Write a promotional tweet for AIPCore Core.' })
}).then(r => r.text()).then(console.log).catch(console.error);
