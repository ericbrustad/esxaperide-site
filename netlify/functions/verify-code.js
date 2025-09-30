
// /.netlify/functions/verify-code.js
// Replace the stub logic with real Stripe verification in production.
// For now: accepts TEST-1234 and anything that matches a simple pattern.

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== 'POST'){
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const { code } = JSON.parse(event.body||'{}');
    if(!code) return { statusCode: 400, body: 'Missing code' };

    // TODO: Replace with Stripe verification:
    // - If you use Payment Links or Checkout Sessions, look up session by code/token
    // - If you use Promo Codes or Coupons, verify via Stripe API with your secret key

    const ok = (code === 'TEST-1234') || /^[A-Z0-9\-]{6,}$/.test(code);
    return { statusCode: 200, body: JSON.stringify({ valid: !!ok }) };
  }catch(err){
    return { statusCode: 500, body: err.message || 'Internal Error' };
  }
};
