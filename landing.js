
// Basic client-side validation & handoff to Netlify Functions
(function(){
  const form = document.getElementById('accessForm');
  const status = document.getElementById('status');
  const beginBtn = document.getElementById('beginBtn');

  // Persist + restore player profile on this device
  const LS_PROFILE = 'sh2_player_profile';
  const profile = JSON.parse(localStorage.getItem(LS_PROFILE) || 'null');
  if(profile){
    document.getElementById('firstName').value = profile.firstName || '';
    document.getElementById('lastName').value = profile.lastName || '';
    document.getElementById('phone').value = profile.phone || '';
    document.getElementById('email').value = profile.email || '';
  }

  function validatePhone(s){
    // very lenient: digits >= 10
    const digits = (s||'').replace(/\D/g,'');
    return digits.length >= 10;
  }
  function setStatus(msg, ok){
    status.textContent = msg || '';
    status.className = ok ? 'success' : (msg ? 'error' : '');
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    setStatus('Validating…');
    beginBtn.disabled = true;

    const code = (document.getElementById('code').value||'').trim();
    const firstName = (document.getElementById('firstName').value||'').trim();
    const lastName = (document.getElementById('lastName').value||'').trim();
    const phone = (document.getElementById('phone').value||'').trim();
    const email = (document.getElementById('email').value||'').trim();
    const consent = document.getElementById('consent').checked;
    const terms = document.getElementById('terms').checked;

    if(!code || !firstName || !lastName || !validatePhone(phone) || !email || !consent || !terms){
      setStatus('Please complete all fields correctly.', false);
      beginBtn.disabled = false;
      return;
    }

    // Verify code via Netlify Function
    try{
      const res = await fetch('/.netlify/functions/verify-code', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ code })
      });
      if(!res.ok){
        const txt = await res.text();
        throw new Error(txt||'Code verification failed');
      }
      const data = await res.json();
      if(!data.valid){
        setStatus('Invalid or unused code. Please check and try again.', false);
        beginBtn.disabled = false;
        return;
      }
    }catch(err){
      setStatus(err.message || 'Unable to verify code right now.', false);
      beginBtn.disabled = false;
      return;
    }

    // Save profile locally (for in-game use & resume)
    const payload = { firstName, lastName, phone, email, consent, terms, ts: Date.now() };
    localStorage.setItem(LS_PROFILE, JSON.stringify(payload));

    // Optionally register remotely (Netlify Function stub)
    try{
      await fetch('/.netlify/functions/register', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
    }catch(_){ /* non-blocking */ }

    setStatus('Access granted. Loading mission…', true);
    // Hand off to the game
    window.location.href = 'mission.html';
  });
})();
